define(['require', 'github:janesconference/KievII@0.6.0/kievII',
    'tuna'], function(require, K2, Tuna) {
  
    var pluginConf = {
        name: "Tuna Tremolo",
        hyaId: 'TunaTremolo',
        osc: false,
        audioOut: 1,
        audioIn: 1,
        version: '0.0.1',
        ui: {
            type: 'canvas',
            width: 274,
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
                intensity: 0.3,    //0 to 1
                rate: 0.1,         //0.001 to 8
                stereoPhase: 0,    //0 to 180
                bypass: 0
            };
        }
        
        this.tremolo = new tuna.Tremolo(this.pluginState);
    
       this.audioSource.connect(this.tremolo.input);
       this.tremolo.connect(this.audioDestination);
       
       // The canvas part
       this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas});
        
       this.viewWidth = args.canvas.width;
       this.viewHeight = args.canvas.height;
       
       var initOffset = 22;
       var knobSpacing = 83;
       var knobTop = 20;
       this.knobDescription = [ {id: 'intensity', init: this.pluginState.intensity, range: [0,1]},
                                {id: 'rate', init: this.pluginState.rate, range: [0.001,8]},
                                {id: 'stereoPhase', init: this.pluginState.stereoPhase, range: [0,180]}
                              ];

        this.findKnob = function (id) {
            var currKnob;
            for (var i = 0; i < this.knobDescription.length; i+=1) {
                currKnob = this.knobDescription[i];
                if (currKnob.id === element) {
                    return this.knobDescription [i];
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
                var currKnob = this.findKnob (element);
                if (currKnob) {
                    var setValue = K2.MathUtils.linearRange (0, 1, currKnob.range[0], currKnob.range[1], value);
                    this.tremolo[element] = this.pluginState[element] = setValue;
                }
                else {
                    console.error ("element not found:",  element);
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

        var onMIDIMessage = function (message, when) {
            var now = this.context.currentTime;
            //console.log ("arrived MIDI message: type / when / now", message.type, when, now);
            if (when && (when < now)) {
                console.log ("TREMOLO: ******** OUT OF TIME CC MESSAGE");
            }

            var parmName;

            // TODO is checking for if (when) ok? It is as long as the host sends 0, null, or undefined for an immediate message
            // and a time value for a time-scheduled message. This should be in the specification somehow.
            
            if (message.type === 'controlchange') {
                /* http://tweakheadz.com/midi-controllers/ */
                // Using undefined controls
                if (message.control === 21) {
                    // Intensity
                    if (when) {
                        // Not automatable
                        return;
                    }
                    else {
                        parmName = "intensity";
                    }
                }
                else if (message.control === 22) {
                    // Rate
                    if (when) {
                        // Not automatable
                        return;
                    }
                    else {
                        parmName = "rate";
                    }
                }
                else if (message.control === 23) {
                    // Stereo Phase
                    if (when) {
                        // Not automatable
                        return;
                    }
                    else {
                        parmName = "stereoPhase";
                    }
                }
                else {
                    return;
                }
                var parameter = this.findKnob (parmName);
                var setValue = K2.MathUtils.linearRange (0, 1, parameter.range[0], parameter.range[1], message.value / 127);
                // WAS: this.tremolo[parmName] = this.pluginState[element] = setValue;
                // Use automate here, because we're Tuna!
                this.tremolo.automate (parmName, setValue, null, null);
                // TODO do we really want to save the MIDI - induced change in the state? This might be OK for keyboards attached, but not ok for sequencers.
                this.pluginState[element] = setValue;
            }
        };

        args.MIDIHandler.setMIDICallback (onMIDIMessage. bind (this));

        // Initialization made it so far: plugin is ready.
        args.hostInterface.setInstanceStatus ('ready');
    };
    
    
    var initPlugin = function(initArgs) {
        var args = initArgs;

        var requireErr = function (err) {
            args.hostInterface.setInstanceStatus ('fatal', {description: 'Error initializing plugin'});
        }.bind(this);
        
        require (['./assets/images/knob_64_64_64.png!image',
                  './assets/images/TTDeck.png!image'],
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
