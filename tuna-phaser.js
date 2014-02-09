define(['require', 'github:janesconference/KievII@0.6.0/kievII',
    'github:janesconference/tuna@master/tuna', './utilities'], function(require, K2, Tuna, u) {
  
    var pluginConf = {
        name: "Tuna Phaser",
        audioOut: 1,
        audioIn: 1,
        version: '0.0.2',
	hyaId: 'TunaPhaser',
        ui: {
            type: 'canvas',
            width: 441,
            height: 131
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
        
        var tuna = new Tuna(this.context);

        if (args.initialState && args.initialState.data) {
            /* Load data */
            this.pluginState = args.initialState.data;
        }
        else {
            /* Use default data */
            this.pluginState = {
                rate: 1.2,                     //0.01 to 8 is a decent range, but higher values are possible
                depth: 0.3,                    //0 to 1
                feedback: 0.2,                 //0 to 1+
                stereoPhase: 30,               //0 to 180
                baseModulationFrequency: 700,  //500 to 1500
                bypass: 0
            };
        }
        
        this.phaser = new tuna.Phaser(this.pluginState);
    
       this.audioSource.connect(this.phaser.input);
       this.phaser.connect(this.audioDestination);
       
       // The canvas part
       this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas});
        
       this.viewWidth = args.canvas.width;
       this.viewHeight = args.canvas.height;
       
       var initOffset = 22;
       var knobSpacing = 83;
       var knobTop = 20;
       this.knobDescription = [ {id: 'rate', init: this.pluginState.rate, range: [0.01, 8]},
                                {id: 'depth', init: this.pluginState.depth, range: [0,1]},
                                {id: 'feedback', init: this.pluginState.feedback, range: [0,1]},
                                {id: 'stereoPhase', init: this.pluginState.stereoPhase, range: [0,180]},
                                {id: 'baseModulationFrequency', init: this.pluginState.baseModulationFrequency, range: [500,1500]}
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
                    this.phaser.automate (element, setValue, 0, this.context.currentTime);
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
        args.hostInterface.setSaveState (saveState.bind(this));

        this.repainter = function (id, value) {
            // Transform the value back
            var parameter = this.findKnob (id);
            var setValue = K2.MathUtils.linearRange (parameter.range[0], parameter.range[1], 0, 1, value);
            this.ui.setValue ({elementID: id, value: setValue, fireCallback:false});
            this.ui.refresh();
        };

        /* 'rate', init: this.plugin
         'depth', init: this.plugi
         'feedback', init: this.pl
         'stereoPhase', init: this
         'baseModulationFrequency'*/

        this.throttledFuncs = {
            rate: u.throttle(function (val) { this.repainter ("rate", val)}, 500).bind(this),
            depth: u.throttle(function (val) { this.repainter ("depth", val)}, 500).bind(this),
            feedback: u.throttle(function (val) { this.repainter ("feedback", val)}, 500).bind(this),
            stereoPhase: u.throttle(function (val) { this.repainter ("stereoPhase", val)}, 500).bind(this),
            baseModulationFrequency: u.throttle(function (val) { this.repainter ("baseModulationFrequency", val)}, 500).bind(this)
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
                        parmName = "rate";
                    }
                }
                else if (message.control === 22) {
                    // curveAmount
                    if (when) {
                        // Not automatable
                        return;
                    }
                    else {
                        parmName = "depth";
                    }
                }
                else if (message.control === 23) {
                    // curveAmount
                    if (when) {
                        // Not automatable
                        return;
                    }
                    else {
                        parmName = "feedback";
                    }
                }
                else if (message.control === 24) {
                    // curveAmount
                    if (when) {
                        // Not automatable
                        return;
                    }
                    else {
                        parmName = "stereoPhase";
                    }
                }
                else if (message.control === 25) {
                    // curveAmount
                    if (when) {
                        // Not automatable
                        return;
                    }
                    else {
                        parmName = "baseModulationFrequency";
                    }
                }
                else {
                    return;
                }

                var parameter = this.findKnob (parmName);
                var setValue = K2.MathUtils.linearRange (0, 1, parameter.range[0], parameter.range[1], message.value / 127);

                if (!when) {
                    // Immediately
                    this.phaser.automate (parmName, setValue, 0, this.context.currentTime);
                    this.pluginState[parmName] = setValue;
                    // Repaint
                    this.throttledFuncs[parmName](setValue);
                }
                else {
                    var now = this.context.currentTime;
                    var delta = when - now;
                    if (delta < 0) {
                        console.log ("PHASER: ******** OUT OF TIME CC MESSAGE");
                    }
                    else {
                        setTimeout (this.throttledFuncs[parmName], delta * 1000, setValue);
                    }
                    // Automate the parameter now
                    this.phaser.automate (parmName, setValue, 0, when);
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
                  './assets/images/TPDeck.png!image'],
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
