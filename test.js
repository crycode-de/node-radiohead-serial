// Umgebungsvariable setzen, um verschiedene Ports nutzen zu können
//process.env['RH_HARDWARESERIAL_DEVICE_NAME'] = '/dev/ttyUSB0';

var rh = require('./build/Release/radiohead-serial.node');

console.log('init');
rh.init('/dev/ttyUSB0',9600,0x01);


rh.start((err, from, len , data)=>{
  if(err){
    console.log('error:', err);
    return;
  }
  console.log(`--> Von: 0x${from.toString(16)}, Länge: ${len}, Daten:`, data, 'ToString: ', data.toString());

  var ans = new Buffer('Huhu\0');
  rh.send(from, ans.length, ans, (err)=>{
    if(err){
      console.log(`<-- ${ans} error:`, err);
      return;
    }
    console.log(`<-- ${ans} ok`);
  });
});

/*rh.send(0x10, 4, 'Hey', (err)=>{
  if(err){
    console.log('<-- error:', err);
    return;
  }
  console.log('<-- ok');
});*/
console.log('---');

setTimeout(()=>{
  console.log('done');
  rh.stop();
},10000);
