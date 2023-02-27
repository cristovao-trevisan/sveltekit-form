// Reexport your entry components here

const value = {
  v: 'Hello World',
  get () { return value.v },
  set(v) { value.v = v },
  get error () { return 'eitcha' }
};

console.log(value, value.error);