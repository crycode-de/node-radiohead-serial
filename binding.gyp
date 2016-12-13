{
  "targets": [
    {
      "target_name": "radiohead-serial",
      "sources": [
        "src/rh-serial.cpp",
        "src/functions.cpp",
        "deps/RadioHead/RHDatagram.cpp",
        "deps/RadioHead/RHReliableDatagram.cpp",
        "deps/RadioHead/RH_Serial.cpp",
        "deps/RadioHead/RHGenericDriver.cpp",
        "deps/RadioHead/RHutil/HardwareSerial.cpp",
        "deps/RadioHead/RHCRC.cpp"
      ],
      "include_dirs": [
        "deps/RadioHead",
        "deps/RadioHead/RHutil"
      ]
    }
  ]
}
