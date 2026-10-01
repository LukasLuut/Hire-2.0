import{n as a,o}from"./index-CWXy2pEJ.js";/**
 * @license lucide-react v0.552.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const n=[["path",{d:"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",key:"vktsd0"}],["circle",{cx:"7.5",cy:"7.5",r:".5",fill:"currentColor",key:"kqv944"}]],s=a("tag",n),c={getCategory:async()=>{const e=await o("/categories",{method:"GET",headers:{"Content-Type":"application/json"}});return!e||typeof e==null?null:e},getCategoryById:async e=>{const t=await o(`/categories/${e}`,{method:"GET",headers:{"Content-Type":"application/json"}});return!t||typeof t==null?null:t},getCategoryNameById:async e=>{const t=await o(`/categories/${e}`,{method:"GET",headers:{"Content-Type":"application/json"}});return!t||typeof t==null?null:t.name}};export{s as T,c};
