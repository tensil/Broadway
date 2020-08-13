    //   return Module;
    //})();
    
    var resultModule;
    if (typeof global !== "undefined"){
      if (global.Module){
        resultModule = global.Module;
      };
    };
    if (typeof Module != "undefined"){
      resultModule = Module;
    };

    resultModule._broadwayOnHeadersDecoded = par_broadwayOnHeadersDecoded;
    resultModule._broadwayOnPictureDecoded = par_broadwayOnPictureDecoded;
    
    var moduleIsReady = false;
    var cbFun;
    var moduleReady = function(){
      moduleIsReady = true;
      if (cbFun){
        cbFun(resultModule);
      }
    };
    
    resultModule.onRuntimeInitialized = function(){
      moduleReady(resultModule);
    };
    return function(callback){
      if (moduleIsReady){
        callback(resultModule);
      }else{
        cbFun = callback;
      };
    };
  };

  return (function(){
    "use strict";
  
  
  var nowValue = function(){
    return (new Date()).getTime();
  };
  
  if (typeof performance != "undefined"){
    if (performance.now){
      nowValue = function(){
        return performance.now();
      };
    };
  };
  
  
  var Decoder = function(parOptions){
    this.options = parOptions || {};
    
    this.now = nowValue;
    
    var asmInstance;
    
    var fakeWindow = {
    };
    
    var toU8Array;
    var toU32Array;
    
    var onPicFun = function ($buffer, width, height) {
      var buffer = this.pictureBuffers[$buffer];
      if (!buffer) {
        buffer = this.pictureBuffers[$buffer] = toU8Array($buffer, (width * height * 3) / 2);
      };
      
      this.onPictureDecoded(buffer, width, height);
    }.bind(this);
    
    var ignore = false;
        
    var ModuleCallback = getModule.apply(fakeWindow, [function () {
    }, onPicFun]);
    
    var MAX_STREAM_BUFFER_LENGTH = 1024 * 1024;
    
    var instance = this;
    this.onPictureDecoded = function (buffer, width, height) {

    };
    
    this.onDecoderReady = function(){};
    
    var bufferedCalls = [];
    this.decode = function decode(typedAr) {
      bufferedCalls.push([typedAr]);
    };
    
    ModuleCallback(function(Module){
      var HEAPU8 = Module.HEAPU8;
      // from old constructor
      Module._broadwayInit();
      
      /**
     * Creates a typed array from a HEAP8 pointer. 
     */
      toU8Array = function(ptr, length) {
        return HEAPU8.subarray(ptr, ptr + length);
      };
      toU32Array = function(ptr, length) {
        //var tmp = HEAPU8.subarray(ptr, ptr + (length * 4));
        return new Uint32Array(HEAPU8.buffer, ptr, length);
      };
      instance.streamBuffer = toU8Array(Module._broadwayCreateStream(MAX_STREAM_BUFFER_LENGTH), MAX_STREAM_BUFFER_LENGTH);
      instance.pictureBuffers = {};

      /**
     * Decodes a stream buffer. This may be one single (unframed) NAL unit without the
     * start code, or a sequence of NAL units with framing start code prefixes. This
     * function overwrites stream buffer allocated by the codec with the supplied buffer.
     */

      instance.decode = function decode(typedAr) {
        // console.info("Decoding: " + buffer.length);

        instance.streamBuffer.set(typedAr);
        Module._broadwayPlayStream(typedAr.length);
      };
      
      if (bufferedCalls.length){
        var bi = 0;
        for (bi = 0; bi < bufferedCalls.length; ++bi){
          instance.decode(bufferedCalls[bi][0]);
        };
        bufferedCalls = [];
      };
      
      instance.onDecoderReady(instance);

    });
  

  };

  
  Decoder.prototype = {
    
  };
  
  /*
    potential worker initialization
  
  */
  
  
  if (typeof self != "undefined"){
    var isWorker = false;
    var decoder;
    var lastBuf;
    var awaiting = 0;
    var pile = [];
    var startDecoding;
    var finishDecoding;
    var timeDecoding;
    
    var memAr = [];
    var getMem = function(length){
      if (memAr.length){
        var u = memAr.shift();
        while (u && u.byteLength !== length){
          u = memAr.shift();
        };
        if (u){
          return u;
        };
      };
      return new ArrayBuffer(length);
    }; 
            
    self.addEventListener('message', function(e) {
      
      if (isWorker){
        if (e.data.reuse){
          memAr.push(e.data.reuse);
        };
        if (e.data.buf){
          decoder.decode(
            new Uint8Array(e.data.buf, e.data.offset || 0, e.data.length)
          );
          return;
        };
                
      }else{
        if (e.data && e.data.type === "Broadway.js - Worker init"){
          isWorker = true;
          decoder = new Decoder(e.data.options);
                           

          decoder.onPictureDecoded = function (buffer, width, height) {
            
            // buffer needs to be copied because we give up ownership
            var copyU8 = new Uint8Array(getMem(buffer.length));
            copyU8.set( buffer, 0, buffer.length );

            postMessage({
              buf: copyU8.buffer, 
              length: buffer.length,
              width: width, 
              height: height
            }, [copyU8.buffer]); // 2nd parameter is used to indicate transfer of ownership

          };
            
          postMessage({ consoleLog: "broadway worker initialized" });
        };
      };


    }, false);
  };
  
  Decoder.nowValue = nowValue;
  
  return Decoder;
  
  })();
  
  
}));

