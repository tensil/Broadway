/*


usage:

p = new Player({
  useWorker: <bool>,
  workerFile: <defaults to "Decoder.js"> // give path to Decoder.js
});

// canvas property represents the canvas node
// put it somewhere in the dom
p.canvas;

p.decode(<binary>);


*/



// universal module definition
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(["./Decoder", "./YUVCanvas"], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require("./Decoder"), require("./YUVCanvas"));
    } else {
        // Browser globals (root is window)
        root.Player = factory(root.Decoder, root.YUVCanvas);
    }
}(this, function (Decoder, WebGLCanvas) {
  "use strict";
  
  
  var nowValue = Decoder.nowValue;
  
  
  var Player = function(parOptions){
    var self = this;
    this._config = parOptions || {};
        
    this.nowValue = nowValue;
    
    this._config.workerFile = this._config.workerFile || "Decoder.js";
    if (this._config.preserveDrawingBuffer){
      this._config.contextOptions = this._config.contextOptions || {};
      this._config.contextOptions.preserveDrawingBuffer = true;
    };
        
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext("webgl");
       
    // choose functions
    this.createCanvasObj = this.createCanvasWebGL;
    this.renderFrame = this.renderFrameWebGL;
        
    var lastWidth;
    var lastHeight;
    var onPictureDecoded = function(buffer, width, height) {
      self.onPictureDecoded(buffer, width, height);
      
      var startTime = nowValue();
      
      if (!buffer) {
        return;
      };
      
      self.renderFrame({
        canvasObj: self.canvasObj,
        data: buffer,
        width: width,
        height: height
      });
      
      if (self.onRenderFrameComplete){
        self.onRenderFrameComplete({
          data: buffer,
          width: width,
          height: height,
          canvasObj: self.canvasObj
        });
      };
      
    };
    
    // provide size
    
    if (!this._config.size){
      this._config.size = {};
    };
    this._config.size.width = this._config.size.width || 200;
    this._config.size.height = this._config.size.height || 200;
    
    if (this._config.useWorker){
      var worker = new Worker(this._config.workerFile);
      this.worker = worker;
      worker.addEventListener('message', function(e) {
        var data = e.data;
        if (data.consoleLog){
          console.log(data.consoleLog);
          return;
        };
        
        onPictureDecoded.call(self, new Uint8Array(data.buf, 0, data.length), data.width, data.height);
        
      }, false);
      
      worker.postMessage({type: "Broadway.js - Worker init", options: {
        memsize: this.memsize,
      }});
      
      this.decode = function(parData){
        // Copy the sample so that we only do a structured clone of the
        // region of interest
        var copyU8 = new Uint8Array(parData.length);
        copyU8.set( parData, 0, parData.length );
        worker.postMessage({buf: copyU8.buffer, offset: 0, length: parData.length}, [copyU8.buffer]); // Send data to our worker.
      };
        
      this.recycleMemory = function(parArray){
        //this.beforeRecycle();
        worker.postMessage({reuse: parArray.buffer}, [parArray.buffer]); // Send data to our worker.
        //this.afterRecycle();
      };
      
    }else{
      
      this.decoder = new Decoder({
      });
      this.decoder.onPictureDecoded = onPictureDecoded;

      this.decode = function(parData){
        self.decoder.decode(parData);
      };
      
    };
    
    this.canvasObj = this.createCanvasObj({
      contextOptions: this._config.contextOptions
    });
    this.canvas = this.canvasObj.canvas;

    this.domNode = this.canvas;
    
    lastWidth = this._config.size.width;
    lastHeight = this._config.size.height;
    
  };
  
  Player.prototype = {
    
    onPictureDecoded: function(buffer, width, height){},
    
    // call when memory of decoded frames is not used anymore
    recycleMemory: function(buf){
    },
    /*beforeRecycle: function(){},
    afterRecycle: function(){},*/
    
    // for both functions options is:
    //
    //  width
    //  height
    //  enableScreenshot
    //
    // returns a object that has a property canvas which is a html5 canvas
    createCanvasWebGL: function(options){
      var canvasObj = this._createBasicCanvasObj(options);
      canvasObj.contextOptions = options.contextOptions;
      return canvasObj;
    },
    
    createCanvasRGB: function(options){
      var canvasObj = this._createBasicCanvasObj(options);
      return canvasObj;
    },
    
    // part that is the same for webGL and RGB
    _createBasicCanvasObj: function(options){
      options = options || {};
      
      var obj = {};
      var width = options.width;
      if (!width){
        width = this._config.size.width;
      };
      var height = options.height;
      if (!height){
        height = this._config.size.height;
      };
      obj.canvas = document.createElement('canvas');
      obj.canvas.width = width;
      obj.canvas.height = height;
      obj.canvas.style.backgroundColor = "#0D0E1B";
      
      
      return obj;
    },
    
    // options:
    //
    // canvas
    // data
    renderFrameWebGL: function(options){
      
      var canvasObj = options.canvasObj;
      
      var width = options.width || canvasObj.canvas.width;
      var height = options.height || canvasObj.canvas.height;
      
      if (canvasObj.canvas.width !== width || canvasObj.canvas.height !== height || !canvasObj.webGLCanvas){
        canvasObj.canvas.width = width;
        canvasObj.canvas.height = height;
        canvasObj.webGLCanvas = new WebGLCanvas({
          canvas: canvasObj.canvas,
          contextOptions: canvasObj.contextOptions,
          width: width,
          height: height
        });
      };
      
      var ylen = width * height;
      var uvlen = (width / 2) * (height / 2);
      
      canvasObj.webGLCanvas.drawNextOutputPicture({
        yData: options.data.subarray(0, ylen),
        uData: options.data.subarray(ylen, ylen + uvlen),
        vData: options.data.subarray(ylen + uvlen, ylen + uvlen + uvlen)
      });
      
      var self = this;
      self.recycleMemory(options.data);
      
    },
    renderFrameRGB: function(options){
      var canvasObj = options.canvasObj;

      var width = options.width || canvasObj.canvas.width;
      var height = options.height || canvasObj.canvas.height;
      
      if (canvasObj.canvas.width !== width || canvasObj.canvas.height !== height){
        canvasObj.canvas.width = width;
        canvasObj.canvas.height = height;
      };
      
      var ctx = canvasObj.ctx;
      var imgData = canvasObj.imgData;

      if (!ctx){
        canvasObj.ctx = canvasObj.canvas.getContext('2d');
        ctx = canvasObj.ctx;

        canvasObj.imgData = ctx.createImageData(width, height);
        imgData = canvasObj.imgData;
      };

      imgData.data.set(options.data);
      ctx.putImageData(imgData, 0, 0);
      var self = this;
      self.recycleMemory(options.data);
      
    }
    
  };
  
  return Player;
  
}));

