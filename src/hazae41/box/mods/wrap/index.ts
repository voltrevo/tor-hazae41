export interface Wrap<T> extends Disposable {
  get(): T;
}

export interface AsyncWrap<T> extends AsyncDisposable {
  get(): T;
}
