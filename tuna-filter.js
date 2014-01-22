define(['require', 'github:janesconference/KievII@0.6.0/kievII',
        'github:janesconference/tuna@master/tuna', './utilities'], function(require, K2, Tuna, u) {
  
    var pluginConf = {
        name: "Tuna Filter",
        osc: false,
        audioOut: 1,
        audioIn: 1,
        version: '0.0.2',
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
                 frequency: 20,         //20 to 22050
                 Q: 1,                  //0.001 to 100
                 gain: 0,               //-40 to 40
                 filterType: 1,
                 bypass: 0
            };
        }
        
        this.filter = new tuna.Filter(this.pluginState);
    
        this.audioSource.connect(this.filter.input);
        this.filter.connect(this.audioDestination);
       
        // The canvas part
        this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas});
        
        this.viewWidth = args.canvas.width;
        this.viewHeight = args.canvas.height;
       
        var initOffset = 22;
        var knobSpacing = 113;
        var knobTop = 93;
        this.knobDescription = [ {id: 'frequency', init: this.pluginState.frequency, range: [20, 22050]},
                                 {id: 'Q', init: this.pluginState.Q, range: [0.001, 100]},
                                 {id: 'gain', init: this.pluginState.gain, range: [-40,40]}
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
                    console.log ("Setting", value, setValue, "to", element);
                    this.filter[element] = this.pluginState[element] = setValue;
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

        var filterList = ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass'];
        /* Label */
        this.label = new K2.Label({
            ID: 'filterLabel',
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
        this.ui.setValue({elementID: "filterLabel", value: filterList[this.pluginState.filterType]});

        /* Buttons */
        var buttonPlus = {
            ID: "buttonPlus",
            left: 40,
            top: 46,
            imagesArray : [buttonPlusImage],
            onValueSet: function () {
                // Plus called
                var currentFilter = this.filter.filterType;
                var filtIndex = null;
                for (var i = 0; i < filterList.length; i+=1) {
                    if (filterList[i] === currentFilter) {
                        filtIndex = i;
                        break;
                    }
                }
                if (filtIndex === null) {
                    return;
                }
                filtIndex = (filtIndex + 1) % filterList.length;
                this.pluginState.filterType = this.filter.filterType = filtIndex;
                // Change the label value here
                console.log (filterList[filtIndex], filtIndex, this.filter.filterType);
                this.ui.setValue({elementID: "filterLabel", slot: 'labelvalue', value: filterList[filtIndex]});
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
                var currentFilter = this.filter.filterType;
                var filtIndex = null;
                for (var i = 0; i < filterList.length; i+=1) {
                    if (filterList[i] === currentFilter) {
                        filtIndex = i;
                        break;
                    }
                }
                if (filtIndex === null) {
                    return;
                }
                filtIndex = filtIndex - 1;
                if (filtIndex < 0) {
                    filtIndex = filterList.length - 1;
                }
                this.pluginState.filterType = this.filter.filterType = filtIndex;
                // Change the label value here
                console.log (filterList[filtIndex], filtIndex, this.filter.filterType);
                this.ui.setValue({elementID: "filterLabel", slot: 'labelvalue', value: filterList[filtIndex]});
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
            frequency: u.throttle(function (val) { this.repainter ("frequency", val); }, 500).bind(this),
            Q: u.throttle(function (val) { this.repainter ("Q", val); }, 500).bind(this),
            gain: u.throttle(function (val) { this.repainter ("gain", val); }, 500).bind(this)
        };

        var onMIDIMessage = function (message, when) {

            var parmName;

            // TODO is checking for if (when) ok? It is as long as the host sends 0, null, or undefined for an immediate message
            // and a time value for a time-scheduled message. This should be in the specification somehow.
            // TODO filetType
            if (message.type === 'controlchange') {
                /* http://tweakheadz.com/midi-controllers/ */
                // Using undefined controls
                if (message.control === 21) {
                    // This is automatable
                    parmName = "frequency";

                }
                else if (message.control === 22) {
                    // This is automatable
                    parmName = "Q";
                }
                else if (message.control === 23) {
                    // This is automatable
                    parmName = "gain";
                }
                else {
                    return;
                }

                var parameter = this.findKnob (parmName);
                var setValue = K2.MathUtils.linearRange (0, 1, parameter.range[0], parameter.range[1], message.value / 127);

                if (!when) {
                    // Immediately
                    this.filter[parmName] = setValue;
                    this.pluginState[parmName] = setValue;
                    // Repaint
                    this.throttledFuncs[parmName](setValue);
                }
                else {
                    var now = this.context.currentTime;
                    var delta = when - now;
                    if (delta < 0) {
                        console.log ("FILTER: ******** OUT OF TIME CC MESSAGE");
                    }
                    else {
                        setTimeout (this.throttledFuncs[parmName], delta * 1000, setValue);
                    }
                    // Automate the parameter now
                    this.filter.automate (parmName, setValue, 0, when);
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
                  './assets/images/TFDeck.png!image',
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
