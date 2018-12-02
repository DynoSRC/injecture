const globalInjectureStore = require('./injecture-store');


const registerDefaults = {
  attributes: {},
  silent: false,
  singleton: false,
  mapInstances: false,
  instanceIndexField: null,
  injections: {},
  interfaces: [],
  factoryArgs: [],
  factoryContext: {},
};

function addToInstanceStore(instanceStore, key, instance, instanceIndexField) {

  const {
    instances,
  } = instanceStore[key];

  // by default they key will just be an auto incrementing number
  // to make it look like an array.
  let index = Object.keys(instances).length;
  if (instanceIndexField) {
    index = instance[instanceIndexField];
  }
  instances[index] = instance;
}

class Injecture {

  constructor(injections) {
    this.get = this.create;
    this.reducers = {};
    this.instanceStore = injections.instanceStore;

    /**
     * Huh?  So the reason we are registering itself
     * is because this module is exporing a signleton
     * so callers can immediately have a "injecture" instance.
     *
     * However there may be times you may want to make your own
     * instance of injecuture, probably for unit test purposes
     */
    this.registerClass(Injecture, {
      injections: {
        'instanceStore': {
          interface: 'instanceStore',
          constructor: true
        }
      }
    });

    // if someone wanted to supply their own injection store
    // (mostly for unit test purposes), then can simply
    // register an interface `injectionStore`, then add an
    // interfaceReducer to return their custom implmentation
    this.register('DefaultInjectionStore', () => { return this.instanceStore }, {
      interfaces: ['instanceStore']
    });
  }

  create(key, ...factoryArgs) {
    if (!this.instanceStore[key]) throw new Error(`Key ${key} not found`);
    const {
      factory, options, instances,
    } = this.instanceStore[key];

    if (!factory) return undefined;

    if (options.singleton && Object.keys(instances).length === 1) {
      return instances[Object.keys(instances)[0]];
    }

    const constructorInjections = {};
    const propInjections = {};
    Object.keys(options.injections).forEach(prop => {

      let injection = options.injections[prop];

      // normalize to object
      if (typeof injection === 'string') {
        injection = {
          key: injection,
          constructor: false
        };
      }

      // flll in defaults;
      injection = Object.assign({}, {
        constructor: false, // true assume prop injected
        constructorArgs: []
      }, injection);

      let instance;
      if (injection.key) {
        const args = [injection.key].concat(injection.constructorArgs);
        instance = this.create.apply(this, args);
      }
      else if (injection.interface) {
        instance = this.getInstanceByInterface(injection.interface);
      }

      if (injection.constructor) {
        constructorInjections[prop] = instance;
      }
      else {
        propInjections[prop] = instance;
      }

    });

    // eslint-disable-next-line prefer-rest-params
    const args = Array.prototype.slice.call(arguments).length > 1 ?
      factoryArgs : options.factoryArgs;

    if (Object.keys(constructorInjections).length > 0) {
      // injections via constructor will always come
      // as FIRST parameter because we have no idea
      // how many constructor args callers will invoke
      // an object with via options.factoryArgs
      args.unshift(constructorInjections);
    }
    const instance = factory.apply(options.factoryContext, args);
    Object.keys(propInjections).forEach(prop => {
      instance[prop] = propInjections[prop];
    });

    // singletons have to be registered
    if (options.singleton || options.mapInstances) {
      addToInstanceStore(this.instanceStore, key, instance, options.instanceIndexField);
    }


    options.interfaces.forEach(interfaceType => {

      if (typeof interfaceType === 'string') {
        interfaceType = {
          type: interfaceType,
          mapInstances: false,
          instanceIndexField: null,
        };
      };

      if (interfaceType.mapInstances) {
        addToInstanceStore(this.instanceStore, interfaceType.type, instance, interfaceType.instanceIndexField);
      }
    });
    return instance;
  }

  /**
   * This will wrap register
   * by providing a default Class factory
   *
   * @param {*} key
   * @param {*} Klass
   * @param {*} options
   */
  registerClass(Klass, options) {
    this.registerClassByKey(Klass.name, Klass, options);
  }

  /**
   * This will wrap register
   * by providing a default Class factory
   *
   * @param {*} key
   * @param {*} Klass
   * @param {*} options
   */
  registerClassByKey(key, Klass, options = {attributes: {}}) {

    this.register(key, function classFactory(...args) {
      if (args.length === 0) return new Klass();
      else if (args.length === 1) return new Klass(args[0]);
      else if (args.length === 2) return new Klass(args[0], args[1]);
      else if (args.length === 3) return new Klass(args[0], args[1], args[2]);
      else if (args.length === 4) return new Klass(args[0], args[1], args[2], args[3]);
      else if (args.length === 5) return new Klass(args[0], args[1], args[2], args[3], args[4]);
      // common, why would anyone need more than 5 constructor args
    }, options);
  }

  register(key, factory, options) {
    options = Object.assign({}, registerDefaults, options);
    if (this.instanceStore[key]) {
      // kinda harsh but we really need to stricly enforce
      // this.  Better blow up at design / testing time
      // rather than have strange errors crop up over time
      throw new Error(`The factory ${key} is already registered`);
    }
    this.instanceStore[key] = {
      factory,
      options,
      instances: {},
    };
    options.interfaces.forEach(interfaceType => {
      // convert to a string
      if (interfaceType.type) interfaceType = interfaceType.type;
      if (!this.instanceStore[interfaceType]) {
        this.instanceStore[interfaceType] = {
          instances: {},
          keys: [],
        };
      }

      // keep a reverse mapping
      this.instanceStore[interfaceType].keys.push(key);

    });
  }

  allInstances(key) {
    if (!this.instanceStore[key]) return [];

    return Object.keys(this.instanceStore[key].instances).map(index => {
      return this.instanceStore[key].instances[index];
    });

  }

  getKeysByInterface(interfaceType) {
    const interfaces = this.instanceStore[interfaceType] || {};
    const selectors = this.selectors[interfaceType] || [defaultSelector];

    const keys = interfaces.keys.map(key => {
      return {key, options: this.instanceStore[key].options};
    });

    return selectors.reduce((classKeys, reducer) => {
      // if the reducer chain already
      // gave an answer to which interface
      // to select, then short circut the chain
      if (classKeys.length === 1) return classKeys;
      return reducer(classKeys);
    }, keys).map(keyObj => keyObj.key);
  }

  addInterfaceSelectors(...selectors) {
    selectors.forEach(selectorObj => {
      this.addInterfaceSelector(selectorObj.interfaceType || selectorObj.key, selectorObj.selector);
    });
  }

  addInterfaceSelctor(interfaceType, selector) {
    if (!this.selctors[interfaceType]) this.selctor[interfaceType] = [];
    this.selctors[interfaceType].push(selector);
  }

  getInstanceByInterface(interfaceType) {
    let key = this.getKeysByInterface(interfaceType);
    if (key.length > 1) {
      console.warn(`Injecture:: there may be a potential issue as getInstanceByInterface found more than one class for interface {${interfaceType}}.  Maybe look at your interfaceReducers?`);
      // take the first one which is debatable,
      // we might want to throw here
      key = key[0];
    }

    return this.get(key);
  }
}

function defaultSelector(keys) {
  return keys;
}

// make the the first one by hand
// Since we are not exposing the Class
// any additional instances will need to
// come from this singleton
const injectureSingleton = new Injecture({ instanceStore: globalInjectureStore });


module.exports = injectureSingleton;
