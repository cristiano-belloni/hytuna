define(['require', 'github:janesconference/KievII@0.6.0/kievII',
    'tuna'], function(require, K2, Tuna) {
  
    var pluginConf = {
        name: "Tuna Wah-Wah",
        osc: false,
        audioOut: 1,
        audioIn: 1,
        version: '0.0.1-alpha1',
        ui: {
            type: 'canvas',
            width: 508,
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
        var switchUpImage =  resources[2];
        var switchDownImage =  resources[3];
        
        var tuna = new Tuna(this.context);

        if (args.initialState && args.initialState.data) {
            /* Load data */
            this.pluginState = args.initialState.data;
        }
        else {
            /* Use default data */
            this.pluginState = {
                automode: true,                //true/false
                baseFrequency: 0.5,            //0 to 1
                excursionOctaves: 2,           //1 to 6
                sweep: 0.2,                    //0 to 1
                resonance: 10,                 //1 to 100
                sensitivity: 0.5,              //-1 to 1
                bypass: 0
            };
        }
        
        this.wahwah = new tuna.WahWah(this.pluginState);
    
       this.audioSource.connect(this.wahwah.input);
       this.wahwah.connect(this.audioDestination);
       
       // The canvas part
       this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas});
        
       this.viewWidth = args.canvas.width;
       this.viewHeight = args.canvas.height;
       
       var initOffset = 22;
       var knobSpacing = 83;
       var knobTop = 20;
       this.knobDescription = [ {id: 'baseFrequency', init: this.pluginState.baseFrequency, range: [0,1]},
                                {id: 'excursionOctaves', init: this.pluginState.excursionOctaves, range: [1,6]},
                                {id: 'sweep', init: this.pluginState.sweep, range: [0,1]},
                                {id: 'resonance', init: this.pluginState.resonance, range: [1,100]},
                                {id: 'sensitivity', init: this.pluginState.sensitivity, range: [-1,1]}
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
                    this.wahwah[element] = this.pluginState[element] = setValue;
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
        
        /* Button */
        var buttonArgs = {
            ID: "autoButton",
            left: 439,
            top: 24,
            imagesArray : [switchDownImage, switchUpImage],
            onValueSet: function (slot, value) {
                if (value === 1) {
                    this.wahwah.automode = this.pluginState.automode = true;
                }
                else {
                    this.wahwah.automode = this.pluginState.automode = false;
                }
                this.ui.refresh();
            }.bind(this),
            isListening: true
        };
        
        this.ui.addElement(new K2.Button(buttonArgs));

        if (this.pluginState.automode) {
            this.ui.setValue ({elementID: buttonArgs.ID, value: 1});
        }
        else {
            this.ui.setValue ({elementID: buttonArgs.ID, value: 0});
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
            args.hostInterface.setInstanceStatus ('fatal', {description: 'Error initializing plugin'});
        }.bind(this);
        
        require (['./assets/images/knob_64_64_64.png!image',
                  './assets/images/TWWDeck.png!image',
                  './assets/images/switch_up.png!image',
                  './assets/images/switch_down.png!image'],
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