const assert = require('assert');

describe('Injecture', function() {

  const injecture = require('../index');

  it('will register a factory by key', done => {

    injecture.register('classA', function() {
      return 'A';
    });

    assert.equal(injecture.create('classA'), 'A');
    done();
  });

  it('will use a default factory for a class', done => {

    class ClassB {
      constructor() {
        this.foo = 'bar';
      }
    }

    injecture.registerClassByKey('class_b', ClassB, {});
    assert.equal(injecture.get('class_b').foo, 'bar');
    done();
  });

  it('will call the factory with context and args from options', done => {

    injecture.register('class_c', function(...args) {

      assert.deepEqual(args, ['foo', 'bar']);
      // eslint-disable-next-line no-invalid-this
      assert.deepEqual(this.hello, 'there');
      done();

    }, {factoryArgs: ['foo', 'bar'], factoryContext: {hello: 'there'}});

    injecture.create('class_c');

  });

  it('registerClass will invoke the constructor with arguments pass into get', done => {

    const argCollector = [];
    injecture.registerClass(class TestConstructor{
      constructor(...args) {
        argCollector.push(args);
      }
    })

    injecture.get('TestConstructor',  'beep', 'boop');
    assert.deepEqual(argCollector.pop(), ['beep', 'boop']);


    injecture.get('TestConstructor',  'meow', 'bark', 'zeep');
    assert.deepEqual(argCollector.pop(), ['meow', 'bark', 'zeep']);

    done();
  });



  it('registerClass will invoke the constructor with arguments from factoryArgs', done => {

    const argCollector = [];
    injecture.registerClass(class TestConstructor2 {
      constructor(...args) {
        argCollector.push(args);
      }
    }, {
      factoryArgs: ['123', '456']
    })

    injecture.get('TestConstructor2');
    assert.deepEqual(argCollector.pop(), ['123', '456'], 'Should pass in factory args into constructor');

    injecture.get('TestConstructor2',  'meow', 'bark', 'zeep');
    assert.deepEqual(argCollector.pop(), ['meow', 'bark', 'zeep'], 'args passed into get still takes precedence');

    done();
  });

  it('will map instances by key field', done => {

    class ClassD {
      constructor(name) {
        this.name = name;
      }
    }

    injecture.register('class_d', function(name) {
      return new ClassD(name);
    }, {
      mapInstances: true,
      instanceIndexField: 'name',
    });

    const instance1 = injecture.create('class_d', 'ryan');
    const instance2 = injecture.create('class_d', 'stevens');

    const instances = injecture.allInstances('class_d');

    assert.equal(instance1, instances[0]);
    assert.equal(instance2, instances[1]);
    assert.equal(instances.length, 2);

    done();
  });


  it('will map instances by interface', done => {

    class ClassE {
      constructor(name) {
        this.name = name;
      }
      msg() {
        return 'hi' + this.name;
      }
    }
    class ClassF {
      constructor(name) {
        this.name = name;
      }
      msg() {
        return 'there' + this.name;
      }
    }
    class ClassG {
      constructor(name) {
        this.name = name;
      }
      msg() {
        return 'there' + this.name;
      }
    }

    injecture.register('ClassE', function(name) {
      return new ClassE(name);
    }, {
      interfaces: [{
        type: 'msg',
        mapInstances: true,
      }],
    });
    injecture.register('ClassF', function(name) {
      return new ClassF(name);
    }, {
      interfaces: [{
        type: 'msg',
        mapInstances: true,
      }],
    });

    injecture.register('ClassG', function(name) {
      return new ClassG(name);
    }, {
      interfaces: [{type: 'msg'}],
    });

    const instance1 = injecture.create('ClassE', 'ryan');
    const instance2 = injecture.create('ClassF', 'stevens');
    const instance3 = injecture.create('ClassG', 'stives');

    const instances = injecture.allInstances('msg');

    assert.equal(instance1, instances[0]);
    assert.equal(instance2, instances[1]);
    assert.equal(instances.length, 2);

    done();
  });


  it('can ask for class keys by interface', done => {

    injecture.registerClass( class ClassH {
      constructor() {
      }
    }, {
      interfaces: ['test1'],
    });

    injecture.registerClass( class ClassI {
      constructor() {
      }
    }, {
      interfaces: ['test1'],
    });

    injecture.registerClass( class ClassJ {
      constructor() {
      }
    }, {
      interfaces: ['abc', 'test1'],
    });

    const keys = injecture.getKeysByInterface('test1');

    assert.equal(keys[0], 'ClassH');
    assert.equal(keys[1], 'ClassI');
    assert.equal(keys[2], 'ClassJ');
    assert.equal(keys.length, 3);

    done();
  });

  it('will enforce singletons', done => {
    let ctr =0;
    injecture.registerClass( class ClassK {
      constructor() {
        this.ctr = ++ctr;
      }
    }, {
      singleton: true,
    });

    assert.equal(injecture.get('ClassK').ctr, 1, 'First get');
    assert.equal(injecture.get('ClassK').ctr, 1, 'second get');
    assert.equal(injecture.get('ClassK').ctr, 1, 'third get');
    assert.equal(ctr, 1);
    done();
  });

  it('can add reducers to supply logic how get the right interface', (done) => {

    injecture.addInterfaceReducers({
      interfaceType: 'bar',
      reducer: function reducer(keys) {
        return keys.filter(key => key.key === 'ClassL');
      },
    });

    injecture.registerClass( class ClassL {
      constructor() {
      }
    }, {
      interfaces: ['bar'],
      singleton: true,
    });

    injecture.registerClass( class ClassM {
      constructor() {
      }
    }, {
      interfaces: ['bar'],
      singleton: true,
    });

    const keys = injecture.getKeysByInterface('bar');
    assert.equal(keys.length, 1);
    assert.equal(keys[0], 'ClassL');

    done();
  });


  it('can return an instance from an interface', (done) => {

    class ClassN {}
    injecture.registerClass(ClassN, {
      interfaces: ['baz']
    });

    const classN = injecture.getInstanceByInterface('baz');
    assert.ok(classN instanceof ClassN);

    done();
  });

  it('when there is no reducer, getInstanceByInterface returns the first registered', done => {
    class ClassO {}
    injecture.registerClass(ClassO, {
      interfaces: ['beep'],
      singleton: true,
    });

    const classO = injecture.getInstanceByInterface('beep');
    assert.ok(classO);
    assert.ok(classO instanceof ClassO);

    // This should POSSIBLY throw. Probably not. I can't think of a valid use case
    // for having two singletons that implement the same interfaces (in the same
    // thread/runtime at least), but I'm 67% sure that one exists.
    injecture.registerClass(class ClassP {}, {
      interfaces: ['beep'],
      singleton: true,
    });

    const keys = injecture.getKeysByInterface('beep');
    assert.equal(keys.length, 2, 'prove that interface beep has two classes');


    // This should DEFINITELY throw, or at least produce a warning. Something is
    // fishy when we are asking for a singleton by interface and there are
    // multiple candidates.
    const secondClassO = injecture.getInstanceByInterface('beep');
    assert.ok(secondClassO);
    assert.ok(secondClassO instanceof ClassO);

    // TODO: spy console.warn to ensure it was called

    done();
  });


  it('getInstanceByInterface will create an instance from the key the reducer returns', done => {

    class ClassQ {
      get() { return 'nike'}
    }
    class ClassR {
      get() { return 'rebok'}
    }

    injecture.registerClass(ClassQ, {
      interfaces: ['shoe']
    });

    injecture.registerClass(ClassR, {
      interfaces: ['shoe']
    });

    let classToFilter = 'ClassR'

    injecture.addInterfaceReducers({
      interfaceType: 'shoe',
      reducer: function reducer(keys) {
        return keys.filter(key => key.key === classToFilter);
      }
    });


    let shoe = injecture.getInstanceByInterface('shoe');
    assert.ok(shoe instanceof ClassR);
    assert.equal(shoe.get(), 'rebok');

    // Change the class the reducer is going to filter on
    // This somewhat shows reducers can be flexible depending
    // how you design them. ALSO, reducers are NOT pure functions
    classToFilter = 'ClassQ';

    shoe = injecture.getInstanceByInterface('shoe');
    assert.ok(shoe instanceof ClassQ);
    assert.equal(shoe.get(), 'nike');


    done();
  });


  it('will not run reducers if another one returns a single key', done => {

    class ClassS { }
    class ClassT { }
    class ClassU { }

    injecture.registerClass(ClassS, {
      interfaces: ['meep']
    });

    injecture.registerClass(ClassT, {
      interfaces: ['meep']
    });

    injecture.registerClass(ClassU, {
      interfaces: ['meep']
    });


    injecture.addInterfaceReducers({
      interfaceType: 'meep',
      reducer: function reducer(keys) {
        return [keys.pop()];
      }
    },{
      interfaceType: 'meep',
      reducer: function reducer(keys) {
        throw new Error('Should not be ran');
      }
    });


    const shoe = injecture.getInstanceByInterface('meep');
    assert.ok(shoe instanceof ClassU);

    done();
  });

  it('will inject a prop into an instance from an injection', done => {

    class ClassV {
      say() {
        return 'hello ' + this.namer.name() + ', ' + this.greeter.ask();
      }
    }
    class ClassW {
      name() {
        return 'ryan';
      }
    }
    class ClassX {
      ask() { return 'how are you'}
    }

    injecture.registerClass(ClassV, {
      injections: {
        namer: 'ClassW',  // shows you can pass a string and that will become { key: ClassW }
        greeter: {
          key: 'ClassX'
        }
      }
    })

    injecture.registerClass(ClassW);
    injecture.registerClass(ClassX);

    const classV = injecture.get('ClassV');

    assert.equal(classV.say(), 'hello ryan, how are you')
    done();
  });

  it('will inject constructor args', done => {
    class ClassY {
      constructor(injections, secondArg, thirdArg) {
        this.injections = injections;
        this.secondArg = secondArg;
        this.thirdArg = thirdArg;
      }
    }

    let instanceCnt =0;
    class ClassZ {
      constructor() {
        instanceCnt++;
      }
      meow() { return 1;}
    }

    injecture.registerClass(ClassY, {
      injections: {
        test: {
          key: 'ClassZ',
          constructor: true
        },
        pest: {
          key: 'ClassZ',
          constructor: true
        }
      }
    });
    injecture.registerClass(ClassZ);

    const y1 = injecture.get('ClassY');
    assert.equal(y1.injections.test.meow(), 1);
    assert.equal(y1.injections.pest.meow(), 1);
    assert.equal(y1.secondArg, undefined);
    assert.equal(y1.thirdArg, undefined);
    assert.equal(instanceCnt, 2);
    assert.equal(Object.keys(y1.injections).length, 2);

    const y2 = injecture.get('ClassY', 'foo', 'bar');
    assert.equal(y2.injections.test.meow(), 1);
    assert.equal(y2.injections.pest.meow(), 1);
    assert.equal(y2.secondArg, 'foo');
    assert.equal(y2.thirdArg, 'bar');
    assert.equal(instanceCnt, 4);
    assert.equal(Object.keys(y2.injections).length, 2);

    done();

  });

  it('will inject by interface', done => {

    class ClassAA {
    }

    class ClassBB {
      what() { return 'footlong' }
    }


    injecture.registerClass(ClassAA, {
      injections: {
        test: {
          interface: 'hotdog'
        }
      }
    });

    injecture.registerClass(ClassBB, {
      interfaces: ['hotdog']
    });

    const aa = injecture.get('ClassAA');
    assert.equal(aa.test.what(), 'footlong');

    done();
  });

  it('can get a new instance of injecture from itself', done => {

    const customStore = {};
    injecture.register('MyCustomStore', function() {
      return customStore;
    }, {
      interfaces: ['instanceStore']
    });

    injecture.addInterfaceReducers({
      interfaceType: 'instanceStore',
      reducer: function(keys) {
        return keys.filter(key => key.key === 'MyCustomStore');
      }
    });

    const newInjecture = injecture.get('Injecture');
    assert.notEqual(newInjecture, injecture);

    assert.equal(Object.keys(customStore).length, 3, 'There should only be Injecture, defaultInstanceStore and the instanceStore interface');
    newInjecture.register(class ClassCC {});
    assert.equal(Object.keys(customStore).length, 4);


    done();
  });

  it('Can ask for keys when no interface exists', done => {

    const keys = injecture.getKeysByInterface('wefoijwegoih2');
    assert.equal(keys.length, 0);
    done();
  });

  it('global store can be cleared', done => {

    injecture.registerClass(class ClassAAA {});

    const globalStore = require('../injecture-store');
    assert.strictEqual(injecture.instanceStore, require('../injecture-store'))
    assert.ok(Object.keys(globalStore).length > 0);

    const clear = require('../clear');
    clear();
    assert.equal(Object.keys(globalStore).length, 0);
    done();
  });

});
