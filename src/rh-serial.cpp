/*
 * NodeJS RadioHead RH_Serial
 *
 * (c) 2016 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * NodeJS Addon for communiation between some RadioHead nodes and NodeJS using
 * the RH_Serial driver of the RadioHead library.
 */

#include <nan.h>

#include <uv.h>

#include <unistd.h>

#include <RHReliableDatagram.h>
#include <RH_Serial.h>
#include <RHutil/HardwareSerial.h>

#include <sys/time.h>

#include "rh-serial.h"
#include "functions.h"


namespace radioHeadSerialAddon {

  /**
   * Initialisierung der RadioHead Library.
   *
   * Parameter die vom NodeJS-Aufruf übergeben weden müssen:
   *  port - String mit dem Device, dass für die Serielle Kommunikation genutzt
   *         werden soll. (z.B. /dev/ttyUSB0)
   *  baud - Baudrate für die Serielle Kommunikation. (z.B. 9600)
   *  addr - Die Adresse dieses Kontens im RadioHead-Netzwerk. (z.B. 0x01)
   */
  void Init(const Nan::FunctionCallbackInfo<v8::Value>& info){

    if (info.Length() < 3) {
      Nan::ThrowError("Wrong number of arguments");
      return;
    }

    if (!info[0]->IsString()) {
      Nan::ThrowError("Args[0] (Port) must be a string");
      return;
    }

    if (!info[1]->IsNumber()) {
      Nan::ThrowError("Args[1] (Baud) must be a number");
      return;
    }

    if (!info[2]->IsNumber()) {
      Nan::ThrowError("Args[2] (Adress) must be a number");
      return;
    }

    // Argumente übernehmen
    v8::String::Utf8Value port(info[0]->ToString());
    int baud = info[1]->NumberValue();
    int ownAddress = info[2]->NumberValue();

    // RadioHead initialisieren
    hardwareserial = new HardwareSerial((char*)*port);
    driver = new RH_Serial(*hardwareserial);
    manager = new RHReliableDatagram(*driver, ownAddress);

    //manager.setThisAddress(ownAddress);

    // Serielle Kommunikation starten
    driver->serial().begin(baud);

    // Manager initialisieren
    if (!manager->init()){
      Nan::ThrowError("Init failed");
      return;
    }

    info.GetReturnValue().Set(Nan::Undefined());
  }

  /**
   * Daten an einen anderen Knoten im RadioHead-Netzwerk senden.
   *
   * Parameter die vom NodeJS-Aufruf übergeben weden müssen:
   *  addr - Die Empfängeradresse. (z.B. 0x05)
   *  len  - Die Anzahl an Bytes, die gesendet werden sollen.
   *  data - Die zu sendenden Daten als Buffer.
   *  cb   - Callback-Funktion.
   */
  void Send(const Nan::FunctionCallbackInfo<v8::Value>& info){

    if(info.Length() < 4){
      Nan::ThrowError("Wrong number of arguments");
      return;
    }

    if(!info[0]->IsNumber()){
      Nan::ThrowError("Args[0] (Address) must be a number");
      return;
    }

    if(!info[1]->IsNumber()){
      Nan::ThrowError("Args[1] (Len) must be a number");
      return;
    }

    if(!info[2]->IsObject()){
      Nan::ThrowError("Args[2] (Data) must be a buffer");
      return;
    }

    if(!info[3]->IsFunction()){
      Nan::ThrowError("Args[3] (Callback) must be a function");
      return;
    }

    // Callback-Funktion, Empfängeradresse und Länge der Daten holen
    v8::Local<v8::Function> callback = info[3].As<v8::Function>();
    work->txAddr = (uint8_t) info[0]->NumberValue();
    uint8_t txLen = (uint8_t) info[1]->NumberValue();

    // Prüfen ob die Daten evtl. zu lang sind
    if(txLen > RH_SERIAL_MAX_MESSAGE_LEN){
      // Daten zu lang... Callback mit Fehlermeldung aufrufen
      info.GetReturnValue().Set(Nan::Undefined());
      const unsigned argc = 1;
      v8::Local<v8::Value> argv[argc] = {
        Nan::Error("data too long")
      };
      Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callback, argc, argv);
      return;
    }

    // Daten aus dem NodeJS-Buffer in den TX-Buffer kopieren
    char* buffer = (char*) node::Buffer::Data(info[2]->ToObject());
    memcpy(&bufTx[0], buffer, txLen);

    // Callback-Funktion merken
    work->txCallback.Reset(callback);

    // Länge übernehmen, damit die Daten gesendet werden
    work->txLen = txLen;

    info.GetReturnValue().Set(Nan::Undefined());
  }

  /**
   * Funktion zur Abarbeitung der async Hauptschleife.
   * Hier wird regelmäßig geprüft, ob eine neue Meldung empfangen wurde und es
   * werden die Daten aus dem TX-Buffer versendet.
   * Wurden Daten empfangen oder versendet werden entsprechende Flags gesetzt
   * und die Schleife verlassen.
   */
  static void WorkAsync(uv_work_t *req){

    // Hauptschleife, die auf Aktionen wartet
    while(!work->stop && !work->rxRunCallback && !work->txRunCallback){

      // Daten empfangen?
      if(manager->available()){
        // Daten empfangen
        work->rxLen = sizeof(bufRx);

        // Daten abrufen und prüfen
        if(manager->recvfromAck(bufRx, &work->rxLen, &work->rxAddr)){
          // Empfangene Daten sind ok...
          // Länge der Daten ist in work->rxLen
          // Die Absenderadresse ist in work->rxAddr

          // Flag setzen, dass die RX-Callback-Funktion ausgeführt werden soll
          work->rxRunCallback = true;

        }else{
          // Empfangene Daten sind nicht ok (z.B. Checksummenfehler) ...

          // Länge der empfangen Daten auf 0 setzen und Flag für RX-Callback-Funktion setzen
          work->rxLen = 0;
          work->rxRunCallback = true;

        }

      // Zu sendende Daten vorhanden?
      }else if(work->txLen > 0){
        // Daten senden
        if(manager->sendtoWait(bufTx, work->txLen, work->txAddr)){
          // erfolgreich gesendet... Flag setzen
          work->txOk = true;
        }else{
          // Senden fehlgeschlagen... Flag setzen
          work->txOk = false;
        }

        // Flag setzen, dass die TX-Callback-Funktion ausgeführt werden soll
        work->txRunCallback = true;

        // Länge der zu sendenden Daten auf 0 setzen, da bereits gesendet
        work->txLen = 0;

      }else {
        // nichts zu tun... 50ms warten
        usleep(50000);
      }

    }
  }

  /**
   * Async-Arbeit abgeschlossen.
   * Callback-Funktionen aufrufen mit entsprechenden Argumenten. (Error und Data)
   * Die Arbeit anschließend einstellen oder neu starten.
   */
  static void WorkAsyncComplete(uv_work_t *req, int status){
    // HandleScope wird hier explizit benötigt, da dies keine eigentlich NaN-Methode ist
    Nan::HandleScope scope;

    // RX-Callback ausführen, wenn Flag gesetzt
    if(work->rxRunCallback){
      // 4 Argumente für die Callback-Funktion...
      // Error, Sender-Adresse, Länge und Daten
      // Error und Daten undefined, wenn nicht vorhanden
      const unsigned argc = 4;
      v8::Local<v8::Value> argv[argc] = {
        Nan::Undefined(),
        Nan::New(work->rxAddr),
        Nan::New(work->rxLen),
        Nan::Undefined()
      };

      if(work->rxLen > 0){
        // Daten empfangen... für Argumente der Callback-Funktion übernehmen

        // Einen Buffer zurückgeben, da evtl. mit Binärdaten gearbeitet wird
        // CopyBuffer anstelle von NewBuffer verwenden, da NewBuffer den Pointer auf
        // bufRx übernehmen und über den Garbage Collector freigeben würde.
        // siehe https://github.com/nodejs/nan/blob/master/doc/buffers.md#nannewbuffer
        argv[3] = Nan::CopyBuffer((char*) bufRx, work->rxLen).ToLocalChecked();

      }else{
        // Keine Daten empfangen
        argv[0] = Nan::Error("nothing revcived");
      }

      // Callback-Funktion aufrufen
      v8::Local<v8::Function> callback = Nan::New(work->rxCallback);
      Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callback, argc, argv);

    }

    // TX-Callback ausführen, wenn Flag gesetzt
    if(work->txRunCallback){
      // 1 Argument für die Callback-Funktion...
      // Error (undefined, wenn es keinen Fehler gab)
      const unsigned argc = 1;
      v8::Local<v8::Value> argv[argc] = {
        Nan::Undefined()
      };

      // Error setzen, wenn Senden nicht ok war
      if(!work->txOk){
        argv[0] = Nan::Error("sendToWait failed");
      }

      // Callback-Funktion aufrufen
      // TODO check if callback is set
      v8::Local<v8::Function> callback = Nan::New(work->txCallback);
      Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callback, argc, argv);

      // Callback-Funktion zurücksetzen, da bereits ausgeführt
      work->txCallback.Reset();
    }

    // Arbeit beenden oder erneut starten?
    if(work->stop){
      // Arbeit einstellen
      work->rxCallback.Reset();
      work->txCallback.Reset();
      delete work;
    }else{
      // Arbeit erneut starten...
      // Flags zurücksetzen
      work->rxRunCallback = false;
      work->rxLen = 0;
      work->txRunCallback = false;
      // Arbeit mittels libuv starten
      uv_queue_work(uv_default_loop(), &work->request, WorkAsync, WorkAsyncComplete);
    }
  }

  /**
   * Funktion zum Starten der Arbeit im Hintergrund.
   *
   * Parameter der vom NodeJS-Aufruf übergeben weden muss:
   *  cb - Callback-Funktion, die bei eingehenden Daten aufgerufen wird mit den Folgenden Argumenten:
   *         err  - Ein ggf. aufgetretener Fehler.
   *         from - Absenderadresse der Nachricht.
   *         len  - Länge der Daten in Bytes.
   *         data - Die empfangen Daten.
   */
  void StartAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info){

    if (!info[0]->IsFunction()) {
      Nan::ThrowError("Args[0] (Callback) must be a function");
      return;
    }

    // Work initialisieren
    work = new Work();
    work->request.data = work;
    work->stop = false;
    work->rxRunCallback = false;
    work->rxLen = 0;
    work->txRunCallback = false;
    work->txLen = 0;
    work->txOk = false;

    // RX-Callback-Funktion übernehmen
    v8::Local<v8::Function> callback = info[0].As<v8::Function>();
    work->rxCallback.Reset(callback);

    // TX-Callback-Funktion zurücksetzen, da hier noch nicht vorhanden
    work->txCallback.Reset();

    // Arbeit mittels libuv starten
    uv_queue_work(uv_default_loop(), &work->request, WorkAsync, WorkAsyncComplete);

    info.GetReturnValue().Set(Nan::Undefined());
  }

  /**
   * Funktion zum Stoppen der Arbeit im Hintergrund.
   * Setzt ein Flag, dass der Arbeitsschleife mitteilt, dass die Arbeit eingestellt werden soll.
   *
   * TODO Callback-Funktion hinzufügen für Zeichen, dass gestoppt wurde
   */
  void StopAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info){
    work->stop = true;

    info.GetReturnValue().Set(Nan::Undefined());
  }

  /**
   * Hook für das Beenden des Addons.
   * Gibt Spreicherbereiche von RadioHead wieder frei.
   */
  static void atExit(void*){
    delete manager;
    delete driver;
    delete hardwareserial;
  }

  /**
  * Init-Funktion, die festlegt was von NodeJS aus sichtbar gemacht wird.
  */
  void initNode(v8::Local<v8::Object> exports){
    // Startzeit festlegen (für RadioHead erforderlich)
    start_millis = time_in_millis();

    // Funktionen exportieren
    exports->Set(Nan::New("init").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(Init)->GetFunction());
    exports->Set(Nan::New("send").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(Send)->GetFunction());
    exports->Set(Nan::New("start").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(StartAsyncWork)->GetFunction());
    exports->Set(Nan::New("stop").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(StopAsyncWork)->GetFunction());

    // AtExit-Hook registrieren
    node::AtExit(atExit);
  }

  // Init des NodeJS-Addons
  // Achtung: Kein ; am Ende!
  NODE_MODULE(radiohead, initNode)
}
