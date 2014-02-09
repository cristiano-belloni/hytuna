define(['require', 'github:janesconference/KievII@0.6.0/kievII',
    'github:janesconference/tuna@master/tuna', './utilities'], function(require, K2, Tuna, u) {
  
    var pluginConf = {
        name: "Tuna Delay",
        audioOut: 1,
        audioIn: 1,
        version: '0.0.2',
	hyaId: 'TunaDelay',
        ui: {
            type: 'canvas',
            width: 441,
            height: 131
        }
    };

    var pluginFunction = function(args, resources) {

        this.id = args.id;
        this.audioSource = args.audioSources[0];
        this.audioDestination = args.audioDestinations[0];
        this.context = args.audioContext;

        var knobImage =  resources[0];
        var deckImage =  resources[1];

        if (args.initialState && args.initialState.data) {
            /* Load data */
            this.pluginState = args.initialState.data;
        }
        else {
            /* Use default data */
            this.pluginState = {
                feedback: 0.45,    //0 to 1+
                delayTime: 150,    //how many milliseconds should the wet signal be delayed?
                wetLevel: 0.25,    //0 to 1+
                dryLevel: 1,       //0 to 1+
                cutoff: 20,        //cutoff frequency of the built in highpass-filter. 20 to 22050
                bypass: 0
            };
        }

        var tuna = new Tuna(this.context);

        this.delay = new tuna.Delay(this.pluginState);


        this.audioSource.connect(this.delay.input);
        this.delay.connect(this.audioDestination);

        // The canvas part
        this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas});

        this.viewWidth = args.canvas.width;
        this.viewHeight = args.canvas.height;

        var initOffset = 22;
        var knobSpacing = 83;
        var knobTop = 20;
        this.knobDescription = [ {id: 'feedback', init: this.pluginState.feedback, range: [0,1]},
                                {id: 'delayTime', init: this.pluginState.delayTime, range: [0,250]},
                                {id: 'wetLevel', init: this.pluginState.wetLevel, range: [0,1]},
                                {id: 'dryLevel', init: this.pluginState.dryLevel, range: [0,1]},
                                {id: 'cutoff', init: this.pluginState.cutoff, range: [20,8000]}
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
                    this.delay[element] = this.pluginState[element] = setValue;
                    this.delay.automate (element, setValue, 0, this.context.currentTime);
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
            return { data: this.pluginState };
        };
        args.hostInterface.setSaveState (saveState.bind (this));

        this.repainter = function (id, value) {
            // Transform the value back
            var parameter = this.findKnob (id);
            var setValue = K2.MathUtils.linearRange (parameter.range[0], parameter.range[1], 0, 1, value);
            this.ui.setValue ({elementID: id, value: setValue, fireCallback:false});
            this.ui.refresh();
        };

        this.throttledFuncs = {
            delayTime: u.throttle(function (val) { this.repainter ("delayTime", val)}, 500).bind(this),
            feedback: u.throttle(function (val) { this.repainter ("feedback", val)}, 500).bind(this),
            cutoff: u.throttle(function (val) { this.repainter ("cutoff", val)}, 500).bind(this),
            wetLevel: u.throttle(function (val) { this.repainter ("wetLevel", val)}, 500).bind(this),
            dryLevel: u.throttle(function (val) { this.repainter ("dryLevel", val)}, 500).bind(this)
        };

        var onMIDIMessage = function (message, when) {

            var parmName;

            // TODO is checking for if (when) ok? It is as long as the host sends 0, null, or undefined for an immediate message
            // and a time value for a time-scheduled message. This should be in the specification somehow.

            if (message.type === 'controlchange') {
                /* http://tweakheadz.com/midi-controllers/ */
                // Using undefined controls
                if (message.control === 21) {
                    // delayTime
                    if (when) {
                        // Not automatable
                        return;
                    }
                    else {
                        parmName = "delayTime";
                    }
                }
                else if (message.control === 22) {
                    // This is automatable
                    parmName = "feedback";

                }
                else if (message.control === 23) {
                    // This is automatable
                    parmName = "cutoff";
                }
                else if (message.control === 24) {
                    // This is automatable
                    parmName = "wetLevel";
                }
                else if (message.control === 25) {
                    // This is automatable
                    parmName = "dryLevel";
                }
                else {
                    return;
                }

                var parameter = this.findKnob (parmName);
                var setValue = K2.MathUtils.linearRange (0, 1, parameter.range[0], parameter.range[1], message.value / 127);

                if (!when) {
                    // Immediately
                    this.delay.automate (parmName, setValue, 0, this.context.currentTime);
                    this.delay[parmName] = this.pluginState[parmName] = setValue;
                    // Repaint
                    this.throttledFuncs[parmName](setValue);
                }
                else {
                    var now = this.context.currentTime;
                    var delta = when - now;
                    if (delta < 0) {
                        console.log ("DELAY: ******** OUT OF TIME CC MESSAGE");
                    }
                    else {
                        setTimeout (this.throttledFuncs[parmName], delta * 1000, setValue);
                    }
                    // Automate the parameter now
                    this.delay.automate (parmName, setValue, 0, when);
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
                  './assets/images/TDDeck.png!image'],
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
