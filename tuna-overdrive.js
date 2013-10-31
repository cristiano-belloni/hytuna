define(['require', 'github:janesconference/KievII@0.6.0/kievII',
    'tuna'], function(require, K2, Tuna) {
  
    var pluginConf = {
        name: "Tuna Overdrive",
        osc: false,
        audioOut: 1,
        audioIn: 1,
        version: '0.0.1-alpha1',
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
                    this.od[element] = this.pluginState[element] = setValue;
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
                console.log (currentAlgo);
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
        args.hostInterface.setSaveState (saveState.bind (this));

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
