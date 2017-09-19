import { Queue } from "typescript-collections";

const subsetFunctions = new WeakMap<SubsetTree<any>, IsSubsetFunction<any>>();

const subsetMemos = new WeakMap<IsSubsetFunction<any>, WeakMap<any, WeakMap<any, boolean>>>();

/**
 * A subset tree self organizes new nodes such that they will be added to place
 * in the tree where it is guaranteed that all nodes in the tree that are
 * subsets of the new node are descendants of that node or one of its siblings.
 *
 * While the tree always has a root node, the root node will not have a value
 * unless all values in the tree are subsets of that node.
 *
 * When the tree is walked superset first (breadth-first traversal), it is
 * guaranteed that for any node that is traversed, all known supersets of that
 * node will have already been traversed.
 *
 * The logic of what constitutes a subset is left to the `isSubset()` function.
 * If two values are both subsets of each other they are deemed to be equal.
 * Inserting a value that is equal to another already in the tree causes the
 * new value to be ignored.
 */
export class SubsetTree<T extends Object> {
  private _size: number;
  private root: RootNode<T>;

  /**
   * Creates an instance of SubsetTree.
   * @param isSubsetFn returns whether the second argument is a subset of the first.
   */
  constructor(isSubsetFn: IsSubsetFunction<T>) {
    subsetFunctions.set(this, isSubsetFn);
    this.root = new RootNode<T>(this);
    this._size = 0;
  }

  get size() {
    return this._size;
  }

  /**
   * Inserts one or more values into the subset tree.
   *
   * @returns the number of unique values added to the tree;
   */
  insert(...values: Array<T>): number {
    let count = 0;
    for (let v of values) {
      if (this.root.insert(v)) {
        // console.log("did insert");
        count++;
      } else {
        // console.log("did not insert");
      }
      // console.log("<<<<<<<<<<");
      // console.log(this.debug());
    }
    this._size += count;
    return count;
  }
  debug(): string {
    return this.root.debug("");
  }

  isSubset(superset: T, subset: T): boolean {
    const isSubset: IsSubsetFunction<T> = subsetFunctions.get(this)!;
    let supersets: WeakMap<T, WeakMap<T, boolean>> | undefined = subsetMemos.get(isSubset);
    if (!supersets) {
      supersets = new WeakMap();
      subsetMemos.set(isSubset, supersets);
    }
    let subsets: WeakMap<T, boolean> | undefined = supersets.get(superset);
    if (!subsets) {
      subsets = new WeakMap();
      supersets.set(superset, subsets);
    }
    let result: boolean | undefined = subsets.get(subset);
    if (result === undefined) {
      result = isSubset(superset, subset);
      subsets.set(subset, result);
    }
    return result;
  }
  /**
   * returns whether subset is a proper subset of superset.
   */
  isProperSubset(superset: T, subset: T): boolean {
    return this.isSubset(superset, subset) && !this.isSubset(subset, superset);
  }

  /**
   * Checks if there is any set in the tree that is a proper superset of the
   * value. This is done by checking the root node's value and its direct children's
   * values to see if the value is a proper subset of any of those values.
   */
  hasProperSupersetOf(value: T): boolean {
    if (this.root.value && this.isProperSubset(this.root.value, value)) {
      return true;
    }
    for (let child of this.root.children) {
      if (this.isSubset(child.value, value) && !this.isSubset(value, child.value)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Walk values for this subtree in superset order, traversing only those
   * nodes that are a superset of the given value. If breakEarly is true, stops
   * when the first subset of the passed value is encountered, but costs an
   * extra subset comparison for each node in the tree that is walked that
   * isn't a superset of the value. Note: this may return the set represented
   * by the passed value.
   */
  *walkSupersetsOf(value: T, breakEarly = false): IterableIterator<T> {
    for (let v of this.walkSupersetOrder()) {
      if (this.isSubset(v, value)) {
        yield v;
      } else if (breakEarly && this.isSubset(value, v)) {
        return;
      }
    }
  }

  /**
   * Walk values for this subtree, The order is such that a superset
   * is traversed before any of its subsets.
   */
  walkSupersetOrder(): IterableIterator<T> {
    return this.root.walkSupersetOrder();
  }
}

class NodeBase<T> {
  root: boolean;
  tree: SubsetTree<T>;
  parent: Node<T> | RootNode<T> | undefined;
  children: Array<Node<T>>;
  value: T | undefined;

  constructor(
    tree: SubsetTree<T>,
    root: boolean,
    parent: Node<T> | RootNode<T> | undefined,
    value: T | undefined
  ) {
    this.tree = tree;
    this.root = root;
    this.parent = parent;
    this.value = value;
    this.children = [];
  }

  /**
   * Remove a node from the child nodes of this node.
   * @returns true if the node was removed.
   */
  removeChild(node: Node<T>): boolean {
    let nodeIdx = this.children.indexOf(node);
    if (nodeIdx < 0) {
      return false;
    } else {
      this.children.splice(nodeIdx, 1);
      return true;
    }
  }

  /**
   * Takes a node from its existing parent and adds it as a child.
   */
  takeChild(node: Node<T>) {
    node.parent.removeChild(node);
    node.parent = <Node<T>>this;
    this.children.push(node);
  }
  moveValueToChild(_value: T | undefined = undefined) {
    // pass;
  }
  /**
   * Inserts a new value into the subset tree.
   * @param newValue The value to be inserted.
   * @returns true if a new node was created.
   */
  insert(newValue: T): boolean {
    if (this.value && this.tree.isSubset(newValue, this.value)) {
      if (!this.root) {
        throw new Error("Cannot insert a superset value except at the root node.");
      }
      this.moveValueToChild(newValue);
      return true;
    } else if (this.root && this.value && !this.tree.isSubset(this.value, newValue)) {
      this.moveValueToChild();
      let newNode = new Node<T>(this.tree, <Node<T>>this, newValue);
      this.children.push(newNode);
      return true;
    }
    let subsets = this.children.filter(child => this.tree.isSubset(newValue, child.value));
    // Only one subset? It might be the same value.
    if (subsets.length === 1 && this.tree.isSubset(subsets[0].value, newValue)) {
      // it's duplicate value.
      return false;
    }
    // if all the values are a subset and there's no root value, just take the value.
    if (subsets.length === this.children.length && !this.value) {
      this.value = newValue;
      return true;
    }
    if (subsets.length === 0) {
      let superset = this.children.find(child => this.tree.isSubset(child.value, newValue));
      if (superset) {
        return superset.insert(newValue);
      } else {
        let newNode = new Node<T>(this.tree, <Node<T>>this, newValue);
        this.children.push(newNode);
        return true;
      }
    } else {
      // add a new child and move the subsets under it.
      let newNode = new Node<T>(this.tree, <Node<T>>this, newValue);
      for (let subset of subsets) {
        newNode.takeChild(subset);
      }
      this.children.push(newNode);
      return true;
    }
  }

  /**
   * Walk values for this subtree, The order is such that a superset
   * is traversed before any of its subsets.
   */
  *walkSupersetOrder(): IterableIterator<T> {
    let q = new Queue<Node<T> | RootNode<T>>();
    q.enqueue(<Node<T>>this);
    while (!q.isEmpty()) {
      let node = q.dequeue();
      if (node.value !== undefined) {
        yield node.value;
      }
      for (let child of node.children) {
        q.enqueue(child);
      }
    }
  }

  debug(level: string): string {
    let v = level + (this.value || "<none>").toString();
    let childLevel = level + "  ";
    for (let child of this.children) {
      v += `\n${child.debug(childLevel)}`;
    }
    return v;
  }
}

class Node<T> extends NodeBase<T> {
  root: false;
  parent: Node<T> | RootNode<T>;
  value: T;
  constructor(tree: SubsetTree<T>, parent: Node<T> | RootNode<T>, value: T) {
    super(tree, false, parent, value);
  }
}

class RootNode<T> extends NodeBase<T> {
  root: true;
  parent: undefined;
  value: T | undefined;
  constructor(tree: SubsetTree<T>, value?: T) {
    super(tree, true, undefined, value);
  }
  moveValueToChild(value: T | undefined = undefined) {
    if (!this.value) {
      throw new Error("cannot move nonexistent value");
    }
    // Create a new node and migrate these children and this value to it
    // then take this value.
    let newNode = new Node<T>(this.tree, this, this.value);
    for (let child of this.children) {
      newNode.takeChild(child);
    }
    this.children = [newNode];
    this.value = value;
  }
}

/**
 * Returns true if value2 is a subset of value1.
 */
export type IsSubsetFunction<T> = (value1: T, value2: T) => boolean;