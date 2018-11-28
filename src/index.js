const globalInjectureStore = require('./injecture-store');

const registerDefaults = {
  attributes: {},
  silent: false,
  singleton: false,
  mapInstances: false,
  instanceIndexField: null,
  interfaces: [],
  factoryArgs: [],
  factoryContext: {},
};

function addToInstanceStore(injectoreStore, key, instance, instanceIndexField) {

  const {
    instances,
  } = injectoreStore[key];

  // by default they key will just be an auto incrementing number
  // to make it look like an array.
  let index = Object.keys(instances).length;
  if (instanceIndexField) {
    index = instance[instanceIndexField];
  }
  instances[index] = instance;
}

class Injecture {

  constructor() {
    this.get = this.create;
    this.reducers = {};
    this.injectoreStore = globalInjectureStore;
  }

  create(key, ...factoryArgs) {
    const {
      factory, options, instances,
    } = this.injectoreStore[key];

    if (!factory) return undefined;

    if (options.singleton && Object.keys(instances).length === 1) {
      return instances[Object.keys(instances)[0]];
    }

    // eslint-disable-next-line prefer-rest-params
    const args = Array.prototype.slice.call(arguments).length > 1 ?
      factoryArgs : options.factoryArgs;
    const instance = factory.apply(options.factoryContext, args);

    // singletons have to be registered
    if (options.singleton || options.mapInstances) {
      addToInstanceStore(this.injectoreStore, key, instance, options.instanceIndexField);
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
        addToInstanceStore(this.injectoreStore, interfaceType.type, instance, interfaceType.instanceIndexField);
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

    this.register(key, function classFactor() {
      return new Klass();
    }, options);
  }

  register(key, factory, options) {
    options = Object.assign({}, registerDefaults, options);
    if (this.injectoreStore[key]) {
      // kinda harsh but we really need to stricly enforce
      // this.  Better blow up at design / testing time
      // rather than have strange errors crop up over time
      throw new Error(`The factory ${key} is already registered`);
    }
    this.injectoreStore[key] = {
      factory,
      options,
      instances: {},
    };
    options.interfaces.forEach(interfaceType => {
      // convert to a string
      if (interfaceType.type) interfaceType = interfaceType.type;
      if (!this.injectoreStore[interfaceType]) {
        this.injectoreStore[interfaceType] = {
          instances: {},
          keys: [],
        };
      }

      // keep a reverse mapping
      this.injectoreStore[interfaceType].keys.push(key);

    });
  }

  allInstances(key) {
    if (!this.injectoreStore[key]) return [];

    return Object.keys(this.injectoreStore[key].instances).map(index => {
      return this.injectoreStore[key].instances[index];
    });

  }

  getKeysByInterface(interfaceType) {
    const interfaces = this.injectoreStore[interfaceType] || {};
    const reducers = this.reducers[interfaceType] || [defaultReducer];

    const keys = interfaces.keys.map(key => {
      return {key, options: this.injectoreStore[key].options};
    });

    return reducers.reduce((classKeys, reducer) => {
      // if the reducer chain already
      // gave an answer to which interface
      // to select, then short circut the chain
      if (classKeys.length === 1) return classKeys;
      return reducer(classKeys);
    }, keys).map(keyObj => keyObj.key);
  }

  addInterfaceReducers(...reducers) {
    reducers.forEach(reducerObj => {
      this.addInterfaceReducer(reducerObj.interfaceType || reducerObj.key, reducerObj.reducer);
    });
  }

  addInterfaceReducer(interfaceType, reducer) {
    if (!this.reducers[interfaceType]) this.reducers[interfaceType] = [];
    this.reducers[interfaceType].push(reducer);
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

function defaultReducer(keys) {
  return keys;
}

const injectureSingleton = new Injecture();

/**
 * Huh?  So the reason we are registering itself
 * is because this module is exporing a signleton
 * so callers can immediately have a "injecture" instance.
 *
 * However there may be times you may want to make your own
 * instance of injecuture, probably for unit test purposes
 */
injectureSingleton.registerClass('injecture', Injecture);

module.exports = injectureSingleton;
