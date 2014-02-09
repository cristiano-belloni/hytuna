define(['require', 'github:janesconference/KievII@0.6.0/kievII',
    'github:janesconference/tuna@master/tuna', './utilities'], function(require, K2, Tuna, u) {
  
    var pluginConf = {
        name: "Tuna Convolver",
        audioOut: 1,
        audioIn: 1,
        version: '0.0.2',
	hyaId: 'TunaConvolver',
        ui: {
            type: 'canvas',
            width: 440,
            height: 282
        }
    };

    var pluginFunction = function(args, resources) {
        
        this.id = args.id;
        this.audioSource = args.audioSources[0];
        this.audioDestination = args.audioDestinations[0];
        this.context = args.audioContext;
        this.canvas = args.canvas;
        this.loadedSample = null;
        
        var knobImage =  resources[0];
        var deckImage =  resources[1];
        
        var tuna = new Tuna(this.context);
        
        this.convo = new tuna.Convolver(this.pluginState);
        
    
        this.audioSource.connect(this.convo.input);
        this.convo.connect(this.audioDestination);
       
        // The canvas part
        this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas});

        // Member methods
        this.drop = function (evt) {
            evt.stopPropagation();
            evt.preventDefault();

            var files = evt.dataTransfer.files;
            var count = files.length;

            // Only call the handler if 1 or more files was dropped.
            if (count > 0)
                this.handleFiles(files);
        }.bind(this);

        this.handleFiles = function (files) {

            var file = files[0];
            if (!file) return;

            //console.log ("Loading ", files);
            var reader = new FileReader();

            // set the file to save in the future
            this.loadedSample = file;

            // init the reader event handlers
            reader.onload = this.handleReaderLoad;
            // begin the read operation
            reader.readAsArrayBuffer(file);

        }.bind(this);

        this.successCallback = function (decoded) {
            //console.log ("Decode succeeded!");
            this.convo.decodedBuffer = decoded;

            this.decoded_arrayL = decoded.getChannelData (0);

            // TODO check if the signal is mono or stero here
            // this.decoded_arrayR = decoded.getChannelData (1);

            //console.log ("I got the data!");

            var waveID = 'wavebox_L';

            if (!(this.ui.isElement(waveID))) {

                // Wavebox parameters
                var waveboxArgs = {
                    ID: waveID,
                    top: 10,
                    left: 10,
                    width: this.canvas.width - 10 * 2,
                    height: 154,
                    isListening: true,
                    waveColor: '#FFBA00',
                    transparency: 0.8
                };

                waveboxArgs.onValueSet = function (slot, value, element) {
                    this.ui.refresh();
                }.bind(this);

                var waveBox_L = new K2.Wavebox(waveboxArgs);
                this.ui.addElement(waveBox_L, {zIndex: 2});
            }

            this.ui.setValue ({elementID: waveID, slot: "waveboxsignal", value: this.decoded_arrayL});

            this.ui.refresh();

        }.bind(this);

        this.errorCallback = function () {
            console.error ("Error!");
            // TODO signal the error to the user
        }.bind(this);

        this.handleReaderLoad = function (evt) {

            this.context.decodeAudioData(evt.target.result, this.successCallback, this.errorCallback);

        }.bind(this);

        // Drop event
        this.noopHandler = function(evt) {
            evt.stopPropagation();
            evt.preventDefault();
        };

        // Init event handlers
        this.canvas.addEventListener("dragenter", this.noopHandler, false);
        this.canvas.addEventListener("dragexit", this.noopHandler, false);
        this.canvas.addEventListener("dragover", this.noopHandler, false);
        this.canvas.addEventListener("drop", this.drop, false);

        if (args.initialState && args.initialState.data) {
            /* Load data */
            this.pluginState = args.initialState.data;
            if (args.initialState.bin && args.initialState.bin.loadedSample) {
                /* Load data */
                this.handleFiles ([args.initialState.bin.loadedSample]);
            }
        }
        else {
            /* Use default data */
            this.pluginState = {
                highCut: 22050,                         //20 to 22050
                lowCut: 20,                             //20 to 22050
                dryLevel: 1,                            //0 to 1+
                wetLevel: 1,                            //0 to 1+
                level: 1,                               //0 to 1+, adjusts total output of both wet and dry
                decodedImpulse: null,
                bypass: 0
            };
        }

        var initOffset = 21;
        var knobSpacing = 83;
        var knobTop = 184;
        this.knobDescription = [ {id: 'highCut', init: this.pluginState.highCut, range: [20,22050]},
            {id: 'lowCut', init: this.pluginState.lowCut, range: [20,22050]},
            {id: 'wetLevel', init: this.pluginState.wetLevel, range: [0,1]},
            {id: 'dryLevel', init: this.pluginState.dryLevel, range: [0,1]},
            {id: 'level', init: this.pluginState.level, range: [0,1]}
        ];

        this.findKnob = function (id) {
            var currKnob;
            for (var i = 0; i < this.knobDescription.length; i+=1) {
                currKnob = this.knobDescription[i];
                if (currKnob.id === id) {
                    return this.knobDescription[i];
                }
            }
        };

        /* deck */
        var bgArgs = new K2.Background({
            ID: 'background',
            image: deckImage,
            top: 0,
            left: 0
        });
    
        this.ui.addElement(bgArgs, {zIndex: 0});
        
        /* knobs */
        var knobArgs = {
             ID: "",
             left: 0,
             top: knobTop,
             sensitivity : 5000,
             tileWidth: 64,
             tileHeight: 64,
             imageNum: 64,
             imagesArray: [knobImage],
             bottomAngularOffset: 33,
             onValueSet: function (slot, value, element) {
                //Find the id
                var knobElIndex = -1;
                var currKnob;
                for (var i = 0; i < this.knobDescription.length; i+=1) {
                    currKnob = this.knobDescription[i];
                    if (currKnob.id === element) {
                        knobElIndex = i;
                        break;
                    }
                }
                if (knobElIndex !== -1) {
                    var setValue = K2.MathUtils.linearRange (0, 1, currKnob.range[0], currKnob.range[1], value);
                    this.convo[element] = this.pluginState[element] = setValue;
                    this.convo.automate (element, setValue, 0, this.context.currentTime);
                }
                else {
                    console.error ("element index invalid:",  knobElIndex);
                }
                
                this.ui.refresh();
             }.bind(this)
         };
         
         for (var i = 0; i < this.knobDescription.length; i+=1) {
             var currKnob = this.knobDescription[i];
             knobArgs.ID = currKnob.id;
             knobArgs.left = (initOffset + i * knobSpacing);
             this.ui.addElement(new K2.Knob(knobArgs));
             var initValue = K2.MathUtils.linearRange (currKnob.range[0], currKnob.range[1], 0, 1, currKnob.init);
             this.ui.setValue ({elementID: knobArgs.ID, value: initValue});
        }
       
        this.ui.refresh();

        var saveState = function () {
            var saveObj = {data: this.pluginState};
            if (this.loadedSample) {
                saveObj.bin = { loadedSample: this.loadedSample };
            }
            return saveObj;
        };
        args.hostInterface.setSaveState (saveState.bind(this));

        this.repainter = function (id, value) {
            // Transform the value back
            var parameter = this.findKnob (id);
            var setValue = K2.MathUtils.linearRange (parameter.range[0], parameter.range[1], 0, 1, value);
            this.ui.setValue ({elementID: id, value: setValue, fireCallback:false});
            this.ui.refresh();
        };

        this.throttledFuncs = {
            highCut: u.throttle(function (val) { this.repainter ("highCut", val)}, 500).bind(this),
            lowCut: u.throttle(function (val) { this.repainter ("lowCut", val)}, 500).bind(this),
            wetLevel: u.throttle(function (val) { this.repainter ("wetLevel", val)}, 500).bind(this),
            dryLevel: u.throttle(function (val) { this.repainter ("dryLevel", val)}, 500).bind(this),
            level: u.throttle(function (val) { this.repainter ("level", val)}, 500).bind(this)
        };

        var onMIDIMessage = function (message, when) {

            var parmName;

            // TODO is checking for if (when) ok? It is as long as the host sends 0, null, or undefined for an immediate message
            // and a time value for a time-scheduled message. This should be in the specification somehow.

            if (message.type === 'controlchange') {
                /* http://tweakheadz.com/midi-controllers/ */
                // Using undefined controls
                if (message.control === 21) {
                    // This is automatable
                    parmName = "highCut";

                }
                else if (message.control === 22) {
                    // This is automatable
                    parmName = "lowCut";
                }
                else if (message.control === 23) {
                    // This is automatable
                    parmName = "wetLevel";
                }
                else if (message.control === 24) {
                    // This is automatable
                    parmName = "dryLevel";
                }
                else if (message.control === 25) {
                    // This is automatable
                    parmName = "level";
                }
                else {
                    return;
                }

                var parameter = this.findKnob (parmName);
                var setValue = K2.MathUtils.linearRange (0, 1, parameter.range[0], parameter.range[1], message.value / 127);

                if (!when) {
                    // Immediately
                    this.convo.automate (parmName, setValue, 0, this.context.currentTime);
                    this.convo[parmName] = this.pluginState[parmName] = setValue;
                    // Repaint
                    this.throttledFuncs[parmName](setValue);
                }
                else {
                    var now = this.context.currentTime;
                    var delta = when - now;
                    if (delta < 0) {
                        console.log ("CONVO: ******** OUT OF TIME CC MESSAGE");
                    }
                    else {
                        setTimeout (this.throttledFuncs[parmName], delta * 1000, setValue);
                    }
                    // Automate the parameter now
                    this.convo.automate (parmName, setValue, 0, when);
                }
            }
        };

        args.MIDIHandler.setMIDICallback (onMIDIMessage.bind (this));

        // Initialization made it so far: plugin is ready.
        args.hostInterface.setInstanceStatus ('ready');
    };
    
    
    var initPlugin = function(initArgs) {
        var args = initArgs;

        var requireErr = function (err) {
            args.hostInterface.setInstanceStatus ('fatal', {description: 'Error initializing plugin'});
        }.bind(this);
        
        require (['./assets/images/knob_64_64_64.png!image',
                  './assets/images/TCoDeck.png!image'],
            function () {
                var resources = arguments;
                pluginFunction.call (this, args, resources);
            }.bind(this),
            requireErr
        );

    };
        
    return {
        initPlugin: initPlugin,
        pluginConf: pluginConf
    };
});
