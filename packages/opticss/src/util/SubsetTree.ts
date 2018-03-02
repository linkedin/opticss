// tslint:disable:prefer-whatever-to-any
import { Queue } from "typescript-collections";

const subsetFunctions = new WeakMap<SubsetTree<any>, IsSubsetFunction<any>>();

const subsetMemos = new WeakMap<IsSubsetFunction<any>, WeakMap<any, WeakMap<any, boolean>>>();

/**
 * A subset tree self organizes new nodes such that they will be added to place
 * in the tree where it is guaranteed that all nodes in the tree that have
 * values that are subsets of the value in the new node are descendants of that
 * node or one of its siblings.
 *
 * While the tree always has a root node, the root node will not have a value
 * unless all values in the tree are subsets of that node.
 *
 * When the tree is walked superset first (breadth-first traversal), it is
 * guaranteed that for any value that is traversed, all values in the tree that
 * are a proper super set of that value will have already been traversed.
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
      try {
        this.root.insert(v);
        count++;
      } catch (e) {
        if (e instanceof DuplicateEntry) {
          // swallow
        } else {
          throw e;
        }
      }
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

  isSameSet(set1: T, set2: T): boolean {
    return this.isSubset(set1, set2) && this.isSubset(set2, set1);
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

abstract class NodeBase<T> {
  root: boolean;
  depth: number;
  tree: SubsetTree<T>;
  parent: NodeBase<T> | undefined;
  children: Array<Node<T>>;
  value: T | undefined;
  danglingSubsets: Set<Node<T>>;

  constructor(
    tree: SubsetTree<T>,
    depth: number,
    root: boolean,
    parent: NodeBase<T> | undefined,
    value: T | undefined,

  ) {
    this.tree = tree;
    this.depth = depth;
    this.root = root;
    this.parent = parent;
    this.value = value;
    this.children = [];
    this.danglingSubsets = new Set();
  }

  insertAt(newValue: T, subsets: Array<Node<T>>): boolean {
    if (this.value && this.tree.isSameSet(newValue, this.value)) {
      throw new DuplicateEntry(this);
    }
    // add a new child and move the subsets under it.
    let newNode = new Node<T>(this.tree, this.depth + 1, <any>this, newValue);
    for (let subset of subsets) {
      if (subset.depth <= newNode.depth) {
        newNode.takeChild(subset);
      } else {
        newNode.danglingSubsets.add(subset);
      }
    }
    this.children.push(newNode);
    return true;
  }

  findParent(newValue: T): InsertionPoint<T> {
    return this.children.map(child => child.findParent(newValue))
                          .reduce((prev, child) => deepestPoint(prev, child), {});
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
    node.parent.danglingSubsets.add(node);
    node.parent = <any>this;
    this.children.push(node);
    this.danglingSubsets.delete(node);
    node.setDepth();
  }

  /**
   * Sets the node's depth to the correct value and propagates the change to
   * its children.
   */
  setDepth() {
    if (!this.parent) return;
    if (this.parent) {
      this.depth = this.parent.depth + 1;
    }
    for (let dangler of this.danglingSubsets) {
      if (dangler.depth <= this.depth) {
        this.takeChild(dangler);
      }
    }
    for (let child of this.children) {
      child.setDepth();
    }
  }

  /**
   * Walk values for this subtree, The order is such that a superset
   * is traversed before any of its subsets.
   */
  *walkSupersetOrder(): IterableIterator<T> {
    let q = new Queue<NodeBase<T>>();
    q.enqueue(this);
    while (!q.isEmpty()) {
      let node = q.dequeue()!;
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

function deepestPoint<T>(point1: InsertionPoint<T>, point2: InsertionPoint<T>): InsertionPoint<T> {
  let subsets = (point1.subsets || []).concat(point2.subsets || []);
  if (point1.parentNode && point2.parentNode) {
    let parent = point1.parentNode.depth > point2.parentNode.depth ? point1.parentNode : point2.parentNode;
    return {
      parentNode: parent,
      subsets,
    };
  } else {
    return {
      parentNode: point1.parentNode || point2.parentNode,
      subsets,
    };
  }
}

class DuplicateEntry extends Error {
  node: NodeBase<any>;
  constructor(node: NodeBase<any>) {
    super(`Duplicate value: ${node}`);
    this.node = node;
  }
}

interface InsertionPoint<T> {
  parentNode?: Node<T>;
  subsets?: Array<Node<T>>;
}

class Node<T> extends NodeBase<T> {
  root: false;
  parent: NodeBase<T>;
  value: T;
  constructor(tree: SubsetTree<T>, depth: number, parent: NodeBase<T>, value: T) {
    super(tree, depth, false, parent, value);
  }
  findSubsetsOf(newValue: T): Array<Node<T>> {
    if (this.tree.isSameSet(this.value, newValue)) {
      throw new DuplicateEntry(this);
    }
    let subsets = new Array<Node<T>>();
    if (this.tree.isSubset(newValue, this.value)) {
      subsets.push(this);
    }
    for (let child of this.children) {
      subsets.splice(subsets.length, 0, ...child.findSubsetsOf(newValue));
    }
    return subsets;
  }
  findParentWithSubsets(newValue: T): InsertionPoint<T> {
    if (this.tree.isSameSet(this.value, newValue)) {
      throw new DuplicateEntry(this);
    }
    if (!this.tree.isSubset(this.value, newValue)) {
      return {
        subsets: this.findSubsetsOf(newValue),
      };
    }
    let point = this.children.map(child => child.findParentWithSubsets(newValue))
                          .reduce((prev, child) => deepestPoint(prev, child), {});
    if (!point.parentNode) {
      point.parentNode = this;
    }
    return point;
  }
}

class RootNode<T> extends NodeBase<T> {
  depth: 0;
  root: true;
  parent: undefined;
  value: T | undefined;
  constructor(tree: SubsetTree<T>, value?: T) {
    super(tree, 0, true, undefined, value);
  }
  moveValueToChild(value: T | undefined = undefined) {
    if (!this.value) {
      throw new Error("cannot move nonexistent value");
    }
    // Create a new node and migrate these children and this value to it
    // then take this value.
    let newNode = new Node<T>(this.tree, 1, this, this.value);
    for (let child of this.children) {
      newNode.takeChild(child);
    }
    this.children = [newNode];
    this.value = value;
  }
  insert(newValue: T): boolean {
    if (this.value) {
      if (this.tree.isSameSet(this.value, newValue)) {
        throw new DuplicateEntry(this);
      }
      if (this.tree.isSubset(newValue, this.value)) {
        this.moveValueToChild(newValue);
        return true;
      } else if (!this.tree.isSubset(this.value, newValue)) {
        this.moveValueToChild();
        let newNode = new Node<T>(this.tree, 1, this, newValue);
        this.children.push(newNode);
        return true;
      }
    }
    let insertionPoints = this.children.map(child => child.findParentWithSubsets(newValue));
    let point = insertionPoints.reduce((prev, child) => deepestPoint(prev, child), {});

    if (point.parentNode) {
      return point.parentNode.insertAt(newValue, point.subsets || []);
    } else {
      return this.insertAt(newValue, point.subsets || []);
    }
  }
}

/**
 * Returns true if value2 is a subset of value1.
 */
export type IsSubsetFunction<T> = (value1: T, value2: T) => boolean;
