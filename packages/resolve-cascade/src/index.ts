/**
 * @module resolve-cascade
 **/

/* tslint:disable */
// Object.entries polyfill for Node.js 6
// TODO: Remove April 2019 when Node.js 6 is EOL'd
if (!(Object as any).entries) {
  (Object as any).entries = function(obj: any){
    let ownProps = Object.keys(obj), i = ownProps.length, resArray = new Array(i);
    while (i--) resArray[i] = [ownProps[i], obj[ownProps[i]]];
    return resArray;
  };
}
/* tslint:enable */

export * from "./Cascade";
export * from "./util";
export * from "./assertCascade";
