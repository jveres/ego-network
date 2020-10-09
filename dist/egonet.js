const e=new TextEncoder;const t=new TextDecoder;function n(e,t){const n=new Uint8Array(e.length+t.length);return n.set(e,0),n.set(t,e.length),n}function r(e,t,n=0){n=Math.max(0,Math.min(n,t.byteLength));const r=t.byteLength-n;return e.byteLength>r&&(e=e.subarray(0,r)),t.set(e,n),e.byteLength}class i extends Error{constructor(e){super(e),this.name="DenoStdInternalError"}}function o(e,t=""){if(!e)throw new i(t)}const s="\r".charCodeAt(0),a="\n".charCodeAt(0);class c extends Error{constructor(e){super("Buffer full"),this.partial=e,this.name="BufferFullError"}}class h extends Deno.errors.UnexpectedEof{constructor(){super("Encountered UnexpectedEof, data only partially read"),this.name="PartialReadError"}}class u{constructor(e,t=4096){this.r=0,this.w=0,this.eof=!1,t<16&&(t=16),this._reset(new Uint8Array(t),e)}static create(e,t=4096){return e instanceof u?e:new u(e,t)}size(){return this.buf.byteLength}buffered(){return this.w-this.r}async _fill(){if(this.r>0&&(this.buf.copyWithin(0,this.r,this.w),this.w-=this.r,this.r=0),this.w>=this.buf.byteLength)throw Error("bufio: tried to fill full buffer");for(let e=100;e>0;e--){const e=await this.rd.read(this.buf.subarray(this.w));if(null===e)return void(this.eof=!0);if(o(e>=0,"negative read"),this.w+=e,e>0)return}throw new Error("No progress after 100 read() calls")}reset(e){this._reset(this.buf,e)}_reset(e,t){this.buf=e,this.rd=t,this.eof=!1}async read(e){let t=e.byteLength;if(0===e.byteLength)return t;if(this.r===this.w){if(e.byteLength>=this.buf.byteLength){const t=await this.rd.read(e);return o((t??0)>=0,"negative read"),t}if(this.r=0,this.w=0,t=await this.rd.read(this.buf),0===t||null===t)return t;o(t>=0,"negative read"),this.w+=t}const n=r(this.buf.subarray(this.r,this.w),e,0);return this.r+=n,n}async readFull(e){let t=0;for(;t<e.length;)try{const n=await this.read(e.subarray(t));if(null===n){if(0===t)return null;throw new h}t+=n}catch(n){throw n.partial=e.subarray(0,t),n}return e}async readByte(){for(;this.r===this.w;){if(this.eof)return null;await this._fill()}const e=this.buf[this.r];return this.r++,e}async readString(e){if(1!==e.length)throw new Error("Delimiter should be a single character");const t=await this.readSlice(e.charCodeAt(0));return null===t?null:(new TextDecoder).decode(t)}async readLine(){let e;try{e=await this.readSlice(a)}catch(e){let{partial:t}=e;if(o(t instanceof Uint8Array,"bufio: caught error from `readSlice()` without `partial` property"),!(e instanceof c))throw e;return!this.eof&&t.byteLength>0&&t[t.byteLength-1]===s&&(o(this.r>0,"bufio: tried to rewind past start of buffer"),this.r--,t=t.subarray(0,t.byteLength-1)),{line:t,more:!this.eof}}if(null===e)return null;if(0===e.byteLength)return{line:e,more:!1};if(e[e.byteLength-1]==a){let t=1;e.byteLength>1&&e[e.byteLength-2]===s&&(t=2),e=e.subarray(0,e.byteLength-t)}return{line:e,more:!1}}async readSlice(e){let t,n=0;for(;;){let r=this.buf.subarray(this.r+n,this.w).indexOf(e);if(r>=0){r+=n,t=this.buf.subarray(this.r,this.r+r+1),this.r+=r+1;break}if(this.eof){if(this.r===this.w)return null;t=this.buf.subarray(this.r,this.w),this.r=this.w;break}if(this.buffered()>=this.buf.byteLength){this.r=this.w;const e=this.buf,t=this.buf.slice(0);throw this.buf=t,new c(e)}n=this.w-this.r;try{await this._fill()}catch(e){throw e.partial=t,e}}return t}async peek(e){if(e<0)throw Error("negative count");let t=this.w-this.r;for(;t<e&&t<this.buf.byteLength&&!this.eof;){try{await this._fill()}catch(e){throw e.partial=this.buf.subarray(this.r,this.w),e}t=this.w-this.r}if(0===t&&this.eof)return null;if(t<e&&this.eof)return this.buf.subarray(this.r,this.r+t);if(t<e)throw new c(this.buf.subarray(this.r,this.w));return this.buf.subarray(this.r,this.r+e)}}class l extends class{constructor(){this.usedBufferBytes=0,this.err=null}size(){return this.buf.byteLength}available(){return this.buf.byteLength-this.usedBufferBytes}buffered(){return this.usedBufferBytes}}{constructor(e,t=4096){super(),this.writer=e,t<=0&&(t=4096),this.buf=new Uint8Array(t)}static create(e,t=4096){return e instanceof l?e:new l(e,t)}reset(e){this.err=null,this.usedBufferBytes=0,this.writer=e}async flush(){if(null!==this.err)throw this.err;if(0!==this.usedBufferBytes){try{await Deno.writeAll(this.writer,this.buf.subarray(0,this.usedBufferBytes))}catch(e){throw this.err=e,e}this.buf=new Uint8Array(this.buf.length),this.usedBufferBytes=0}}async write(e){if(null!==this.err)throw this.err;if(0===e.length)return 0;let t=0,n=0;for(;e.byteLength>this.available();){if(0===this.buffered())try{n=await this.writer.write(e)}catch(e){throw this.err=e,e}else n=r(e,this.buf,this.usedBufferBytes),this.usedBufferBytes+=n,await this.flush();t+=n,e=e.subarray(n)}return n=r(e,this.buf,this.usedBufferBytes),this.usedBufferBytes+=n,t+=n,t}}function d(){let e;const t=new Promise((t,n)=>{e={resolve:t,reject:n}});return Object.assign(t,e)}class f{constructor(){this.iteratorCount=0,this.yields=[],this.throws=[],this.signal=d()}add(e){++this.iteratorCount,this.callIteratorNext(e)}async callIteratorNext(e){try{const{value:t,done:n}=await e.next();n?--this.iteratorCount:this.yields.push({iterator:e,value:t})}catch(e){this.throws.push(e)}this.signal.resolve()}async*iterate(){for(;this.iteratorCount>0;){await this.signal;for(let e=0;e<this.yields.length;e++){const{iterator:t,value:n}=this.yields[e];yield n,this.callIteratorNext(t)}if(this.throws.length){for(const e of this.throws)throw e;this.throws.length=0}this.yields.length=0,this.signal=d()}}[Symbol.asyncIterator](){return this.iterate()}}const g=/[^\t\x20-\x7e\x80-\xff]/g;function p(e){return null==e?"":(n=e,t.decode(n));var n}function y(e){return e.charCodeAt(0)}class w{constructor(e){this.r=e}async readLine(){const e=await this.readLineSlice();return null===e?null:p(e)}async readMIMEHeader(){const e=new Headers;let t,n=await this.r.peek(1);if(null===n)return null;if(n[0]!=y(" ")&&n[0]!=y("\t")||(t=await this.readLineSlice()),n=await this.r.peek(1),null===n)throw new Deno.errors.UnexpectedEof;if(n[0]==y(" ")||n[0]==y("\t"))throw new Deno.errors.InvalidData("malformed MIME header initial line: "+p(t));for(;;){const t=await this.readLineSlice();if(null===t)throw new Deno.errors.UnexpectedEof;if(0===t.byteLength)return e;let n=t.indexOf(y(":"));if(n<0)throw new Deno.errors.InvalidData("malformed MIME header line: "+p(t));const r=p(t.subarray(0,n));if(""==r)continue;for(n++;n<t.byteLength&&(t[n]==y(" ")||t[n]==y("\t"));)n++;const i=p(t.subarray(n)).replace(g,encodeURI);try{e.append(r,i)}catch{}}}async readLineSlice(){let e;for(;;){const t=await this.r.readLine();if(null===t)return null;const{line:r,more:i}=t;if(!e&&!i)return 0===this.skipSpace(r)?new Uint8Array(0):r;if(e=e?n(e,r):r,!i)break}return e}skipSpace(e){let t=0;for(let n=0;n<e.length;n++)e[n]!==y(" ")&&e[n]!==y("\t")&&t++;return t}}var b;!function(e){e[e.Continue=100]="Continue",e[e.SwitchingProtocols=101]="SwitchingProtocols",e[e.Processing=102]="Processing",e[e.EarlyHints=103]="EarlyHints",e[e.OK=200]="OK",e[e.Created=201]="Created",e[e.Accepted=202]="Accepted",e[e.NonAuthoritativeInfo=203]="NonAuthoritativeInfo",e[e.NoContent=204]="NoContent",e[e.ResetContent=205]="ResetContent",e[e.PartialContent=206]="PartialContent",e[e.MultiStatus=207]="MultiStatus",e[e.AlreadyReported=208]="AlreadyReported",e[e.IMUsed=226]="IMUsed",e[e.MultipleChoices=300]="MultipleChoices",e[e.MovedPermanently=301]="MovedPermanently",e[e.Found=302]="Found",e[e.SeeOther=303]="SeeOther",e[e.NotModified=304]="NotModified",e[e.UseProxy=305]="UseProxy",e[e.TemporaryRedirect=307]="TemporaryRedirect",e[e.PermanentRedirect=308]="PermanentRedirect",e[e.BadRequest=400]="BadRequest",e[e.Unauthorized=401]="Unauthorized",e[e.PaymentRequired=402]="PaymentRequired",e[e.Forbidden=403]="Forbidden",e[e.NotFound=404]="NotFound",e[e.MethodNotAllowed=405]="MethodNotAllowed",e[e.NotAcceptable=406]="NotAcceptable",e[e.ProxyAuthRequired=407]="ProxyAuthRequired",e[e.RequestTimeout=408]="RequestTimeout",e[e.Conflict=409]="Conflict",e[e.Gone=410]="Gone",e[e.LengthRequired=411]="LengthRequired",e[e.PreconditionFailed=412]="PreconditionFailed",e[e.RequestEntityTooLarge=413]="RequestEntityTooLarge",e[e.RequestURITooLong=414]="RequestURITooLong",e[e.UnsupportedMediaType=415]="UnsupportedMediaType",e[e.RequestedRangeNotSatisfiable=416]="RequestedRangeNotSatisfiable",e[e.ExpectationFailed=417]="ExpectationFailed",e[e.Teapot=418]="Teapot",e[e.MisdirectedRequest=421]="MisdirectedRequest",e[e.UnprocessableEntity=422]="UnprocessableEntity",e[e.Locked=423]="Locked",e[e.FailedDependency=424]="FailedDependency",e[e.TooEarly=425]="TooEarly",e[e.UpgradeRequired=426]="UpgradeRequired",e[e.PreconditionRequired=428]="PreconditionRequired",e[e.TooManyRequests=429]="TooManyRequests",e[e.RequestHeaderFieldsTooLarge=431]="RequestHeaderFieldsTooLarge",e[e.UnavailableForLegalReasons=451]="UnavailableForLegalReasons",e[e.InternalServerError=500]="InternalServerError",e[e.NotImplemented=501]="NotImplemented",e[e.BadGateway=502]="BadGateway",e[e.ServiceUnavailable=503]="ServiceUnavailable",e[e.GatewayTimeout=504]="GatewayTimeout",e[e.HTTPVersionNotSupported=505]="HTTPVersionNotSupported",e[e.VariantAlsoNegotiates=506]="VariantAlsoNegotiates",e[e.InsufficientStorage=507]="InsufficientStorage",e[e.LoopDetected=508]="LoopDetected",e[e.NotExtended=510]="NotExtended",e[e.NetworkAuthenticationRequired=511]="NetworkAuthenticationRequired"}(b||(b={}));const m=new Map([[b.Continue,"Continue"],[b.SwitchingProtocols,"Switching Protocols"],[b.Processing,"Processing"],[b.EarlyHints,"Early Hints"],[b.OK,"OK"],[b.Created,"Created"],[b.Accepted,"Accepted"],[b.NonAuthoritativeInfo,"Non-Authoritative Information"],[b.NoContent,"No Content"],[b.ResetContent,"Reset Content"],[b.PartialContent,"Partial Content"],[b.MultiStatus,"Multi-Status"],[b.AlreadyReported,"Already Reported"],[b.IMUsed,"IM Used"],[b.MultipleChoices,"Multiple Choices"],[b.MovedPermanently,"Moved Permanently"],[b.Found,"Found"],[b.SeeOther,"See Other"],[b.NotModified,"Not Modified"],[b.UseProxy,"Use Proxy"],[b.TemporaryRedirect,"Temporary Redirect"],[b.PermanentRedirect,"Permanent Redirect"],[b.BadRequest,"Bad Request"],[b.Unauthorized,"Unauthorized"],[b.PaymentRequired,"Payment Required"],[b.Forbidden,"Forbidden"],[b.NotFound,"Not Found"],[b.MethodNotAllowed,"Method Not Allowed"],[b.NotAcceptable,"Not Acceptable"],[b.ProxyAuthRequired,"Proxy Authentication Required"],[b.RequestTimeout,"Request Timeout"],[b.Conflict,"Conflict"],[b.Gone,"Gone"],[b.LengthRequired,"Length Required"],[b.PreconditionFailed,"Precondition Failed"],[b.RequestEntityTooLarge,"Request Entity Too Large"],[b.RequestURITooLong,"Request URI Too Long"],[b.UnsupportedMediaType,"Unsupported Media Type"],[b.RequestedRangeNotSatisfiable,"Requested Range Not Satisfiable"],[b.ExpectationFailed,"Expectation Failed"],[b.Teapot,"I'm a teapot"],[b.MisdirectedRequest,"Misdirected Request"],[b.UnprocessableEntity,"Unprocessable Entity"],[b.Locked,"Locked"],[b.FailedDependency,"Failed Dependency"],[b.TooEarly,"Too Early"],[b.UpgradeRequired,"Upgrade Required"],[b.PreconditionRequired,"Precondition Required"],[b.TooManyRequests,"Too Many Requests"],[b.RequestHeaderFieldsTooLarge,"Request Header Fields Too Large"],[b.UnavailableForLegalReasons,"Unavailable For Legal Reasons"],[b.InternalServerError,"Internal Server Error"],[b.NotImplemented,"Not Implemented"],[b.BadGateway,"Bad Gateway"],[b.ServiceUnavailable,"Service Unavailable"],[b.GatewayTimeout,"Gateway Timeout"],[b.HTTPVersionNotSupported,"HTTP Version Not Supported"],[b.VariantAlsoNegotiates,"Variant Also Negotiates"],[b.InsufficientStorage,"Insufficient Storage"],[b.LoopDetected,"Loop Detected"],[b.NotExtended,"Not Extended"],[b.NetworkAuthenticationRequired,"Network Authentication Required"]]);function L(e,t){const n=new w(t);let r=!1;const i=[];return{read:async function(s){if(r)return null;const[a]=i;if(a){const e=a.data.byteLength-a.offset,t=Math.min(e,s.byteLength);for(let e=0;e<t;e++)s[e]=a.data[a.offset+e];if(a.offset+=t,a.offset===a.data.byteLength&&(i.shift(),null===await n.readLine()))throw new Deno.errors.UnexpectedEof;return t}const c=await n.readLine();if(null===c)throw new Deno.errors.UnexpectedEof;const[h]=c.split(";"),u=parseInt(h,16);if(Number.isNaN(u)||u<0)throw new Error("Invalid chunk size");if(u>0){if(u>s.byteLength){let e=await t.readFull(s);if(null===e)throw new Deno.errors.UnexpectedEof;const n=new Uint8Array(u-s.byteLength);if(e=await t.readFull(n),null===e)throw new Deno.errors.UnexpectedEof;return i.push({offset:0,data:n}),s.byteLength}{const e=s.subarray(0,u);if(null===await t.readFull(e))throw new Deno.errors.UnexpectedEof;if(null===await n.readLine())throw new Deno.errors.UnexpectedEof;return u}}if(o(0===u),null===await t.readLine())throw new Deno.errors.UnexpectedEof;return await async function(e,t){const n=function(e){if(null==e)return;const t=e.split(",").map(e=>e.trim().toLowerCase());if(0===t.length)throw new Deno.errors.InvalidData("Empty trailer header.");const n=t.filter(e=>R(e));if(n.length>0)throw new Deno.errors.InvalidData(`Prohibited trailer names: ${Deno.inspect(n)}.`);return new Headers(t.map(e=>[e,""]))}(e.get("trailer"));if(null==n)return;const r=[...n.keys()],i=new w(t),o=await i.readMIMEHeader();if(null==o)throw new Deno.errors.InvalidData("Missing trailer header.");const s=[...o.keys()].filter(e=>!r.includes(e));if(s.length>0)throw new Deno.errors.InvalidData(`Undeclared trailers: ${Deno.inspect(s)}.`);for(const[t,n]of o)e.append(t,n);const a=r.filter(e=>!o.has(e));if(a.length>0)throw new Deno.errors.InvalidData(`Missing trailers: ${Deno.inspect(a)}.`);e.delete("trailer")}(e,t),r=!0,null}}}function R(e){return new Set(["transfer-encoding","content-length","trailer"]).has(e.toLowerCase())}async function v(t,n){const r=n.status||200,i=m.get(r),s=l.create(t);if(!i)throw new Deno.errors.InvalidData("Bad status code");n.body||(n.body=new Uint8Array),"string"==typeof n.body&&(n.body=e.encode(n.body));let a=`HTTP/1.1 ${r} ${i}\r\n`;const c=n.headers??new Headers;n.body&&!c.get("content-length")&&(n.body instanceof Uint8Array?a+=`content-length: ${n.body.byteLength}\r\n`:c.get("transfer-encoding")||(a+="transfer-encoding: chunked\r\n"));for(const[e,t]of c)a+=`${e}: ${t}\r\n`;a+="\r\n";const h=e.encode(a);if(o(await s.write(h)===h.byteLength),n.body instanceof Uint8Array){o(await s.write(n.body)===n.body.byteLength)}else if(c.has("content-length")){const e=c.get("content-length");o(null!=e);const t=parseInt(e);o(await Deno.copy(n.body,s)===t)}else await async function(t,n){const r=l.create(t);for await(const t of Deno.iter(n)){if(t.byteLength<=0)continue;const n=e.encode(t.byteLength.toString(16)+"\r\n"),i=e.encode("\r\n");await r.write(n),await r.write(t),await r.write(i)}const i=e.encode("0\r\n\r\n");await r.write(i)}(s,n.body);if(n.trailers){const t=await n.trailers();await async function(t,n,r){const i=n.get("trailer");if(null===i)throw new TypeError("Missing trailer header.");const o=n.get("transfer-encoding");if(null===o||!o.match(/^chunked/))throw new TypeError(`Trailers are only allowed for "transfer-encoding: chunked", got "transfer-encoding: ${o}".`);const s=l.create(t),a=i.split(",").map(e=>e.trim().toLowerCase()),c=a.filter(e=>R(e));if(c.length>0)throw new TypeError(`Prohibited trailer names: ${Deno.inspect(c)}.`);const h=[...r.keys()].filter(e=>!a.includes(e));if(h.length>0)throw new TypeError(`Undeclared trailers: ${Deno.inspect(h)}.`);for(const[t,n]of r)await s.write(e.encode(`${t}: ${n}\r\n`));await s.write(e.encode("\r\n")),await s.flush()}(s,c,t)}await s.flush()}async function E(e,t){const n=new w(t),r=await n.readLine();if(null===r)return null;const i=await n.readMIMEHeader();if(null===i)throw new Deno.errors.UnexpectedEof;const o=new N;return o.conn=e,o.r=t,[o.method,o.url,o.proto]=r.split(" ",3),[o.protoMinor,o.protoMajor]=function(e){switch(e){case"HTTP/1.1":return[1,1];case"HTTP/1.0":return[1,0];default:{const t=1e6;if(!e.startsWith("HTTP/"))break;const n=e.indexOf(".");if(n<0)break;const r=e.substring(e.indexOf("/")+1,n),i=Number(r);if(!Number.isInteger(i)||i<0||i>t)break;const o=e.substring(n+1),s=Number(o);if(!Number.isInteger(s)||s<0||s>t)break;return[i,s]}}}(o.proto),o.headers=i,function(e){const t=e.headers.get("Content-Length");if(t){const n=t.split(",");if(n.length>1){const t=[...new Set(n.map(e=>e.trim()))];if(t.length>1)throw Error("cannot contain multiple Content-Length headers");e.headers.set("Content-Length",t[0])}const r=e.headers.get("Content-Length");if("HEAD"===e.method&&r&&"0"!==r)throw Error("http: method cannot contain a Content-Length");if(r&&e.headers.has("transfer-encoding"))throw new Error("http: Transfer-Encoding and Content-Length cannot be send together")}}(o),o}class N{constructor(){this.done=d(),this._contentLength=void 0,this._body=null,this.finalized=!1}get contentLength(){if(void 0===this._contentLength){const e=this.headers.get("content-length");e?(this._contentLength=parseInt(e),Number.isNaN(this._contentLength)&&(this._contentLength=null)):this._contentLength=null}return this._contentLength}get body(){if(!this._body)if(null!=this.contentLength)this._body=function(e,t){let n=0,r=!1;return{read:async function(i){if(r)return null;let o;const s=e-n;if(s>=i.byteLength)o=await t.read(i);else{const e=i.subarray(0,s);o=await t.read(e)}return null!==o&&(n+=o),r=n===e,o}}}(this.contentLength,this.r);else{const e=this.headers.get("transfer-encoding");if(null!=e){o(e.split(",").map(e=>e.trim().toLowerCase()).includes("chunked"),'transfer-encoding must include "chunked" if content-length is not set'),this._body=L(this.headers,this.r)}else this._body={read:e=>Promise.resolve(null)}}return this._body}async respond(e){let t;try{await v(this.w,e)}catch(e){try{this.conn.close()}catch{}t=e}if(this.done.resolve(t),t)throw t}async finalize(){if(this.finalized)return;const e=this.body,t=new Uint8Array(1024);for(;null!==await e.read(t););this.finalized=!0}}class T{constructor(e){this.listener=e,this.closing=!1,this.connections=[]}close(){this.closing=!0,this.listener.close();for(const e of this.connections)try{e.close()}catch(e){if(!(e instanceof Deno.errors.BadResource))throw e}}async*iterateHttpRequests(t){const n=new u(t),r=new l(t);for(;!this.closing;){let o;try{o=await E(t,n)}catch(t){(t instanceof Deno.errors.InvalidData||t instanceof Deno.errors.UnexpectedEof)&&await v(r,{status:400,body:(i=t.message+"\r\n\r\n",e.encode(i))});break}if(null===o)break;o.w=r,yield o;if(await o.done)return void this.untrackConnection(o.conn);await o.finalize()}var i;this.untrackConnection(t);try{t.close()}catch(e){}}trackConnection(e){this.connections.push(e)}untrackConnection(e){const t=this.connections.indexOf(e);-1!==t&&this.connections.splice(t,1)}async*acceptConnAndIterateHttpRequests(e){if(this.closing)return;let t;try{t=await this.listener.accept()}catch(t){if(t instanceof Deno.errors.BadResource||t instanceof Deno.errors.InvalidData||t instanceof Deno.errors.UnexpectedEof)return e.add(this.acceptConnAndIterateHttpRequests(e));throw t}this.trackConnection(t),e.add(this.acceptConnAndIterateHttpRequests(e)),yield*this.iterateHttpRequests(t)}[Symbol.asyncIterator](){const e=new f;return e.add(this.acceptConnAndIterateHttpRequests(e)),e.iterate()}}var I={},A=!1;function U(){if(A)return I;return A=!0,I=function(e){!function(e){if(!e)throw new Error("Eventify cannot use falsy object as events subject");for(var t=["on","fire","off"],n=0;n<t.length;++n)if(e.hasOwnProperty(t[n]))throw new Error("Subject cannot be eventified, since it already has property '"+t[n]+"'")}(e);var t=function(e){var t=Object.create(null);return{on:function(n,r,i){if("function"!=typeof r)throw new Error("callback is expected to be a function");var o=t[n];return o||(o=t[n]=[]),o.push({callback:r,ctx:i}),e},off:function(n,r){if(void 0===n)return t=Object.create(null),e;if(t[n])if("function"!=typeof r)delete t[n];else for(var i=t[n],o=0;o<i.length;++o)i[o].callback===r&&i.splice(o,1);return e},fire:function(n){var r,i=t[n];if(!i)return e;arguments.length>1&&(r=Array.prototype.splice.call(arguments,1));for(var o=0;o<i.length;++o){var s=i[o];s.callback.apply(s.ctx,r)}return e}}}(e);return e.on=t.on,e.off=t.off,e.fire=t.fire,e}}var q={},D=!1,k="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:global;var P=function(){if(D)return q;D=!0,q=function(s){"uniqueLinkId"in(s=s||{})&&(console.warn("ngraph.graph: Starting from version 0.14 `uniqueLinkId` is deprecated.\nUse `multigraph` option instead\n","\n","Note: there is also change in default behavior: From now on each graph\nis considered to be not a multigraph by default (each edge is unique)."),s.multigraph=s.uniqueLinkId);void 0===s.multigraph&&(s.multigraph=!1);if("function"!=typeof Map)throw new Error("ngraph.graph requires `Map` to be defined. Please polyfill it before using ngraph");var a=new Map,c=[],h={},u=0,l=s.multigraph?function(e,t,n){var r=o(e,t),s=h.hasOwnProperty(r);if(s||I(e,t)){s||(h[r]=0);var a="@"+ ++h[r];r=o(e+a,t+a)}return new i(e,t,n,r)}:function(e,t,n){var r=o(e,t);return new i(e,t,n,r)},d=[],f=A,g=A,p=A,y=A,w={addNode:L,addLink:function(e,t,n){p();var i=R(e)||L(e),o=R(t)||L(t),s=l(e,t,n);c.push(s),r(i,s),e!==t&&r(o,s);return f(s,"add"),y(),s},removeLink:T,removeNode:v,getNode:R,getNodeCount:E,getLinkCount:N,getLinksCount:N,getNodesCount:E,getLinks:function(e){var t=R(e);return t?t.links:null},forEachNode:D,forEachLinkedNode:function(e,t,n){var r=R(e);if(r&&r.links&&"function"==typeof t)return n?function(e,t,n){for(var r=0;r<e.length;++r){var i=e[r];if(i.fromId===t&&n(a.get(i.toId),i))return!0}}(r.links,e,t):function(e,t,n){for(var r=0;r<e.length;++r){var i=e[r],o=i.fromId===t?i.toId:i.fromId;if(n(a.get(o),i))return!0}}(r.links,e,t)},forEachLink:function(e){var t,n;if("function"==typeof e)for(t=0,n=c.length;t<n;++t)e(c[t])},beginUpdate:p,endUpdate:y,clear:function(){p(),D((function(e){v(e.id)})),y()},hasLink:I,hasNode:R,getLink:I};return e(w),function(){var e=w.on;function t(){return w.beginUpdate=p=U,w.endUpdate=y=q,f=b,g=m,w.on=e,e.apply(w,arguments)}w.on=t}(),w;function b(e,t){d.push({link:e,changeType:t})}function m(e,t){d.push({node:e,changeType:t})}function L(e,t){if(void 0===e)throw new Error("Invalid node identifier");p();var r=R(e);return r?(r.data=t,g(r,"update")):(r=new n(e,t),g(r,"add")),a.set(e,r),y(),r}function R(e){return a.get(e)}function v(e){var t=R(e);if(!t)return!1;p();var n=t.links;if(n){t.links=null;for(var r=0;r<n.length;++r)T(n[r])}return a.delete(e),g(t,"remove"),y(),!0}function E(){return a.size}function N(){return c.length}function T(e){if(!e)return!1;var n=t(e,c);if(n<0)return!1;p(),c.splice(n,1);var r=R(e.fromId),i=R(e.toId);return r&&(n=t(e,r.links))>=0&&r.links.splice(n,1),i&&(n=t(e,i.links))>=0&&i.links.splice(n,1),f(e,"remove"),y(),!0}function I(e,t){var n,r=R(e);if(!r||!r.links)return null;for(n=0;n<r.links.length;++n){var i=r.links[n];if(i.fromId===e&&i.toId===t)return i}return null}function A(){}function U(){u+=1}function q(){0===(u-=1)&&d.length>0&&(w.fire("changed",d),d.length=0)}function D(e){if("function"!=typeof e)throw new Error("Function is expected to iterate over graph nodes. You passed "+e);for(var t=a.values(),n=t.next();!n.done;){if(e(n.value))return!0;n=t.next()}}};var e=U();function t(e,t){if(!t)return-1;if(t.indexOf)return t.indexOf(e);var n,r=t.length;for(n=0;n<r;n+=1)if(t[n]===e)return n;return-1}function n(e,t){(this||k).id=e,(this||k).links=null,(this||k).data=t}function r(e,t){e.links?e.links.push(t):e.links=[t]}function i(e,t,n,r){(this||k).fromId=e,(this||k).toId=t,(this||k).data=n,(this||k).id=r}function o(e,t){return e.toString()+"👉 "+t.toString()}return q}();let x={};const S=Deno.env.get("HTTP_PROXY");if(S){const e=new URL(S);x={headers:{Authorization:"Basic "+btoa(e.username+":"+e.password)}},console.info(`Using HTTP_PROXY (origin="${e.origin}", Authorization="Basic ***...***")`)}class C{constructor(e={query:""}){this.elapsedMs=0,this.maxDistance=Number.NEGATIVE_INFINITY,this.graph=P(),this.query=e.query,this.depth=e.depth??C.DEFAULT_GRAPH_DEPTH,this.pattern=e.pattern??C.DEFAULT_SEARCH_PATTERN,this.radius=e.radius??C.DEFAULT_GRAPH_RADIUS}async fetchAutocomplete(e,t){const n=e+this.pattern,r=await fetch("http://suggestqueries.google.com/complete/search?&client=firefox&gl=us&hl=en&q="+encodeURIComponent(n),x);if(r.status===b.OK){const e=await r.json(),n=new Set;for(let r of e[1].slice(0,t))r.split(this.pattern).slice(1).map(e=>{new RegExp("^[0-9.]+$").test(e)||n.add(e)});return n}throw new Error(`${r.status} ${r.statusText}`)}async build(){if(""===this.query)return;const e=performance.now();this.graph.beginUpdate();let t=[this.query],n=[0];for(let e=0;e<this.depth;e++){let r=[],i=[];for(let o=0;o<t.length;o++){const s=n[o];if(s>=this.radius)continue;const a=t[o],c=await this.fetchAutocomplete(a,this.radius-s);this.graph.getNode(a)||this.graph.addNode(a,{count:1,depth:a===this.query?0:e+1});let h=c.size,u=1;c.forEach(t=>{const n=s+u;n>this.maxDistance&&(this.maxDistance=n);const o=this.graph.getNode(t);if(o){o.data.count++;const e=this.graph.getLink(a,t),r=this.graph.getLink(t,a);e||r?e?e.data.weight+=h:r.data.weight+=h:this.graph.addLink(a,t,{distance:n,weight:h,query:`${a}${this.pattern}${t}`})}else this.graph.addNode(t,{count:1,depth:e+1}),this.graph.addLink(a,t,{distance:n,weight:h,query:`${a}${this.pattern}${t}`}),i.push(n),r.push(t);h-=1,u+=1})}t=r,n=i}this.graph.endUpdate(),this.elapsedMs=performance.now()-e,console.log(`build() took ${this.elapsedMs}ms`)}toObject(){let e=Number.NEGATIVE_INFINITY;this.graph.forEachLink(t=>{t.data.weight>e&&(e=t.data.weight)});const t={nodes:[],links:[],query:this.query,depth:this.depth,radius:this.radius,maxWeight:e,maxDistance:this.maxDistance,pattern:this.pattern,elapsedMs:this.elapsedMs};return this.graph.forEachNode(e=>{t.nodes.push({id:e.id,...e.data})}),this.graph.forEachLink(e=>{t.links.push({source:e.fromId,target:e.toId,...e.data})}),t}}C.DEFAULT_GRAPH_DEPTH=1,C.DEFAULT_SEARCH_PATTERN=" vs ",C.DEFAULT_GRAPH_RADIUS=10;const M=Deno.env.get("PORT")??"8080",F=["https://ego.jveres.me"],H=new Map,_=new Headers,$=async(e,t)=>{console.log(`${e.method} ${e.url}`);const n=`${t.query}#${t.depth??C.DEFAULT_GRAPH_DEPTH}#${t.pattern??C.DEFAULT_SEARCH_PATTERN}#${t.radius??C.DEFAULT_GRAPH_RADIUS}`;let r=H.get(n);if(r&&Date.now()-r.date<108e5)console.info(`${e.method} ${e.url} Found in cache`),_.set("fly-cache-status","HIT");else{const i=new C({query:t.query,depth:t.depth,radius:t.radius});await i.build(),console.info(`${e.method} ${e.url} ${r?"Refreshed in cache":"Cached"} at ${H.size}`),r={date:Date.now(),value:JSON.stringify(i.toObject())},H.set(n,r),H.size>500&&H.delete(H.keys().next().value),_.set("fly-cache-status","MISS")}return e.respond({status:b.OK,headers:_,body:r.value})},B=async e=>(console.error(`${e.method} ${e.url} Not acceptable`),e.respond({status:b.NotAcceptable,headers:_,body:JSON.stringify({message:"Not acceptable"})})),O=async e=>(console.warn(`${e.method} ${e.url} Not Found`),e.respond({status:b.NotFound,headers:_,body:JSON.stringify({message:"Request not found"})})),G=async(e,t)=>(console.error(`${e.method} ${e.url} ${t}`),e.respond({status:b.InternalServerError,headers:_,body:JSON.stringify({message:"Internal server error",error:t})})),z=function(e){"string"==typeof e&&(e=function(e){let t;try{const n=e.startsWith(":")?"0.0.0.0"+e:e;t=new URL("http://"+n)}catch{throw new TypeError("Invalid address.")}if(t.username||t.password||"/"!=t.pathname||t.search||t.hash)throw new TypeError("Invalid address.");return{hostname:t.hostname,port:""===t.port?80:Number(t.port)}}(e));const t=Deno.listen(e);return new T(t)}({hostname:"0.0.0.0",port:Number(M)});console.log("Server is running at 0.0.0.0:"+M),console.log("Redis is accessible at "+Deno.env.get("FLY_REDIS_CACHE_URL")),(async()=>{for await(const e of z){const t=e.headers.get("origin");t&&-1!==F.indexOf(t)&&_.set("Access-Control-Allow-Origin",t);const n=e.headers.get("host"),r=new URLSearchParams(e.url.slice(1));n==="localhost:"+M||_.get("Access-Control-Allow-Origin")?"GET"===e.method&&r.get("q")?$(e,{query:r.get("q")??"",...r.get("d")&&{depth:Number(r.get("d"))},...r.get("r")&&{radius:Number(r.get("r"))}}).catch(async({message:t})=>{try{await G(e,t)}catch(e){console.error(e)}}):O(e):B(e)}})();
//# sourceMappingURL=egonet.js.map
