define(['require', 'kievII', 'tuna-amd', 'image'], function(require, K2, Tuna) {
  
    var pluginConf = {
        name: "Tuna Chorus",
        osc: false,
        audioOut: 1,
        audioIn: 1,
        version: '0.0.1-alpha1',
        ui: {
            type: 'canvas',
            width: 274,
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
        
        var tuna = new Tuna(this.context);

        if (args.initialState && args.initialState.data) {
            /* Load data */
            this.pluginState = args.initialState.data;
        }
        else {
            /* Use default data */
            this.pluginState = {
                rate: 1.5,         //0.01 to 8+
                feedback: 0.2,     //0 to 1+
                delay: 0.0045,     //0 to 1
                bypass: 0
            };
        }
        
        this.chorus = new tuna.Chorus(this.pluginState);
    
        this.audioSource.connect(this.chorus.input);
        this.chorus.connect(this.audioDestination);
       
        // The canvas part
        this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas});
        
        this.viewWidth = args.canvas.width;
        this.viewHeight = args.canvas.height;
       
        var initOffset = 22;
        var knobSpacing = 83;
        var knobTop = 20;
        this.knobDescription = [ {id: 'rate', init: this.pluginState.rate, range: [0.01,8]},
                                {id: 'feedback', init: this.pluginState.feedback, range: [0,1]},
                                {id: 'delay', init: this.pluginState.delay, range: [0,1]}
                              ];

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
                this.pluginState[element] = value;
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
                    this.chorus[element] =  setValue;
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
        args.hostInterface.setSaveState (saveState);

        // Initialization made it so far: plugin is ready.
        args.hostInterface.setInstanceStatus ('ready');
    };
    
    
    var initPlugin = function(initArgs) {
        var args = initArgs;

        var requireErr = function (err) {
            var failedId = err.requireModules && err.requireModules[0];
            requirejs.undef(failedId);
            args.hostInterface.setInstanceStatus ('fatal', {description: 'Error initializing plugin: ' + failedId});
        }.bind(this);

        var resList = [ 'image!./assets/images/knob_64_64_64.png!rel',
                        'image!./assets/images/TCDeck.png!rel'];

        require (resList,
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
