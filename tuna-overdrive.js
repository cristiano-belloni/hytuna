define(['require', 'github:janesconference/KievII@0.6.0/kievII',
    'github:janesconference/tuna@master/tuna', './utilities'], function(require, K2, Tuna, u) {
  
    var pluginConf = {
        name: "Tuna Overdrive",
        audioOut: 1,
        audioIn: 1,
        version: '0.0.2',
	hyaId: 'TunaOverdrive',
        ui: {
            type: 'canvas',
            width: 332,
            height: 204
        }
    };
  
    var pluginFunction = function(args, resources) {
        
        this.name = args.name;
        this.id = args.id;
        this.audioSource = args.audioSources[0];
        this.audioDestination = args.audioDestinations[0];
        this.context = args.audioContext;
        
        var knobImage =  resources[0];
        var deckImage =  resources[1];
        var buttonPlusImage = resources[2];
        var buttonMinusImage = resources[3];
        
        var tuna = new Tuna(this.context);

        if (args.initialState && args.initialState.data) {
            /* Load data */
            this.pluginState = args.initialState.data;
        }
        else {
            /* Use default data */
            this.pluginState = {
                outputGain: 0.5,         //0 to 1+
                drive: 0.7,              //0 to 1
                curveAmount: 1,          //0 to 1
                algorithmIndex: 0,
                bypass: 0
            };
        }
        
        this.od = new tuna.Overdrive(this.pluginState);
    
        this.audioSource.connect(this.od.input);
        this.od.connect(this.audioDestination);
       
        // The canvas part
        this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas});
        
        this.viewWidth = args.canvas.width;
        this.viewHeight = args.canvas.height;
       
        var initOffset = 22;
        var knobSpacing = 113;
        var knobTop = 93;
        this.knobDescription = [ {id: 'outputGain', init: this.pluginState.outputGain, range: [0, 1]},
                                 {id: 'drive', init: this.pluginState.drive, range: [0, 1]},
                                 {id: 'curveAmount', init: this.pluginState.curveAmount, range: [0, 1]}
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
                    this.pluginState[element] = setValue;
                    this.od.automate (element, setValue, 0, this.context.currentTime);
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

        var algoN = 5;
        /* Label */
        this.label = new K2.Label({
            ID: 'algoLabel',
            width : 50,
            height : 18,
            top : 46,
            left : 166,
            transparency: 0.87,
            textColor: "white",
            objParms: {
                font: "18px Arial",
                textBaseline: "top",
                textAlign: "center"
            }
        });
        
        this.ui.addElement(this.label, {zIndex: 3});
        this.ui.setValue({elementID: "algoLabel", value: "Algorithm: " + this.pluginState.algorithmIndex});

        /* Buttons */
        var buttonPlus = {
            ID: "buttonPlus",
            left: 40,
            top: 46,
            imagesArray : [buttonPlusImage],
            onValueSet: function () {
                // Plus called
                var currentAlgo = this.od.algorithmIndex;
                currentAlgo = (currentAlgo + 1) % (algoN + 1);
                this.pluginState.algorithmIndex = this.od.algorithmIndex = currentAlgo;
                // Change the label value here
                this.ui.setValue({elementID: "algoLabel", slot: 'labelvalue', value: "Algorithm: " + currentAlgo});
                this.ui.refresh();
            }.bind(this)
        };
        var buttonMinus = {
            ID: "buttonMinus",
            left: 262,
            top: 46,
            imagesArray : [buttonMinusImage],
            onValueSet: function () {
                // Minus called
                var currentAlgo = this.od.algorithmIndex;
                currentAlgo -= 1;
                if (currentAlgo < 0) {
                    currentAlgo = algoN;
                }
                // Change the label value here
                this.pluginState.algorithmIndex = this.od.algorithmIndex = currentAlgo;
                this.ui.setValue({elementID: "algoLabel", slot: 'labelvalue', value: "Algorithm: " + currentAlgo});
                this.ui.refresh();
            }.bind(this)
        };

        this.ui.addElement(new K2.Button(buttonPlus), {zIndex: 1});
        this.ui.addElement(new K2.Button(buttonMinus), {zIndex: 1});
       
        this.ui.refresh();

        var saveState = function () {
            return { data: this.pluginState };
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
            curveAmount: u.throttle(function (val) { this.repainter ("curveAmount", val)}, 500).bind(this),
            drive: u.throttle(function (val) { this.repainter ("drive", val)}, 500).bind(this),
            outputGain: u.throttle(function (val) { this.repainter ("outputGain", val)}, 500).bind(this)
        };

        var onMIDIMessage = function (message, when) {

            var parmName;

            // TODO is checking for if (when) ok? It is as long as the host sends 0, null, or undefined for an immediate message
            // and a time value for a time-scheduled message. This should be in the specification somehow.

            if (message.type === 'controlchange') {
                /* http://tweakheadz.com/midi-controllers/ */
                // Using undefined controls
                if (message.control === 21) {
                    // curveAmount
                    if (when) {
                        // Not automatable
                        return;
                    }
                    else {
                        parmName = "curveAmount";
                    }
                }
                else if (message.control === 22) {
                    // This is automatable
                    parmName = "drive";

                }
                else if (message.control === 23) {
                    // This is automatable
                    parmName = "outputGain";
                }
                else {
                    return;
                }

                var parameter = this.findKnob (parmName);
                var setValue = K2.MathUtils.linearRange (0, 1, parameter.range[0], parameter.range[1], message.value / 127);

                if (!when) {
                    // Immediately
                    this.od.automate (parmName, setValue, 0, this.context.currentTime);
                    this.pluginState[parmName] = setValue;
                    // Repaint
                    this.throttledFuncs[parmName](setValue);
                }
                else {
                    var now = this.context.currentTime;
                    var delta = when - now;
                    if (delta < 0) {
                        console.log ("OVERDRIVE: ******** OUT OF TIME CC MESSAGE");
                    }
                    else {
                        setTimeout (this.throttledFuncs[parmName], delta * 1000, setValue);
                    }
                    // Automate the parameter now
                    this.od.automate (parmName, setValue, 0, when);
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
                  './assets/images/TODeck.png!image',
                  './assets/images/button_plus.png!image',
                  './assets/images/button_minus.png!image'],
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
