function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {
    };
    Object.keys(descriptor).forEach(function(key) {
        desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;
    if ("value" in desc || desc.initializer) {
        desc.writable = true;
    }
    desc = decorators.slice().reverse().reduce(function(desc, decorator) {
        return decorator(target, property, desc) || desc;
    }, desc);
    if (context && desc.initializer !== void 0) {
        desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
        desc.initializer = undefined;
    }
    if (desc.initializer === void 0) {
        Object.defineProperty(target, property, desc);
        desc = null;
    }
    return desc;
}
var _class, _dec, _dec1, _dec2, _dec3;
const SERVER_HOST = "0.0.0.0";
const SERVER_PORT = Deno.env.get("PORT") ?? "8080";
const ALLOWED_ORIGINS = [
    "https://ego.jveres.me"
];
const CACHE_EXPIRATION_MS = 12 * 60 * 60 * 1000;
var exports = {
}, _dewExec = false;
function dew() {
    if (_dewExec) return exports;
    _dewExec = true;
    exports = function eventify(subject) {
        validateSubject(subject);
        var eventsStorage = createEventsStorage(subject);
        subject.on = eventsStorage.on;
        subject.off = eventsStorage.off;
        subject.fire = eventsStorage.fire;
        return subject;
    };
    function createEventsStorage(subject) {
        var registeredEvents = Object.create(null);
        return {
            on: function(eventName, callback, ctx) {
                if (typeof callback !== 'function') {
                    throw new Error('callback is expected to be a function');
                }
                var handlers = registeredEvents[eventName];
                if (!handlers) {
                    handlers = registeredEvents[eventName] = [];
                }
                handlers.push({
                    callback: callback,
                    ctx: ctx
                });
                return subject;
            },
            off: function(eventName, callback) {
                var wantToRemoveAll = typeof eventName === 'undefined';
                if (wantToRemoveAll) {
                    registeredEvents = Object.create(null);
                    return subject;
                }
                if (registeredEvents[eventName]) {
                    var deleteAllCallbacksForEvent = typeof callback !== 'function';
                    if (deleteAllCallbacksForEvent) {
                        delete registeredEvents[eventName];
                    } else {
                        var callbacks = registeredEvents[eventName];
                        for(var i = 0; i < callbacks.length; ++i){
                            if (callbacks[i].callback === callback) {
                                callbacks.splice(i, 1);
                            }
                        }
                    }
                }
                return subject;
            },
            fire: function(eventName) {
                var callbacks = registeredEvents[eventName];
                if (!callbacks) {
                    return subject;
                }
                var fireArguments;
                if (arguments.length > 1) {
                    fireArguments = Array.prototype.splice.call(arguments, 1);
                }
                for(var i = 0; i < callbacks.length; ++i){
                    var callbackInfo = callbacks[i];
                    callbackInfo.callback.apply(callbackInfo.ctx, fireArguments);
                }
                return subject;
            }
        };
    }
    function validateSubject(subject) {
        if (!subject) {
            throw new Error('Eventify cannot use falsy object as events subject');
        }
        var reservedWords = [
            'on',
            'fire',
            'off'
        ];
        for(var i = 0; i < reservedWords.length; ++i){
            if (subject.hasOwnProperty(reservedWords[i])) {
                throw new Error("Subject cannot be eventified, since it already has property '" + reservedWords[i] + "'");
            }
        }
    }
    return exports;
}
var exports1 = {
}, _dewExec1 = false;
var _global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : global;
function dew1() {
    if (_dewExec1) return exports1;
    _dewExec1 = true;
    exports1 = createGraph;
    var eventify = dew();
    function createGraph(options) {
        options = options || {
        };
        if ('uniqueLinkId' in options) {
            console.warn('ngraph.graph: Starting from version 0.14 `uniqueLinkId` is deprecated.\n' + 'Use `multigraph` option instead\n', '\n', 'Note: there is also change in default behavior: From now on each graph\n' + 'is considered to be not a multigraph by default (each edge is unique).');
            options.multigraph = options.uniqueLinkId;
        }
        if (options.multigraph === undefined) options.multigraph = false;
        if (typeof Map !== 'function') {
            throw new Error('ngraph.graph requires `Map` to be defined. Please polyfill it before using ngraph');
        }
        var nodes = new Map();
        var links = [], multiEdges = {
        }, suspendEvents = 0, createLink = options.multigraph ? createUniqueLink : createSingleLink, changes = [], recordLinkChange = noop, recordNodeChange = noop, enterModification = noop, exitModification = noop;
        var graphPart = {
            addNode: addNode,
            addLink: addLink,
            removeLink: removeLink,
            removeNode: removeNode,
            getNode: getNode,
            getNodeCount: getNodeCount,
            getLinkCount: getLinkCount,
            getLinksCount: getLinkCount,
            getNodesCount: getNodeCount,
            getLinks: getLinks,
            forEachNode: forEachNode,
            forEachLinkedNode: forEachLinkedNode,
            forEachLink: forEachLink,
            beginUpdate: enterModification,
            endUpdate: exitModification,
            clear: clear,
            hasLink: getLink,
            hasNode: getNode,
            getLink: getLink
        };
        eventify(graphPart);
        monitorSubscribers();
        return graphPart;
        function monitorSubscribers() {
            var realOn = graphPart.on;
            graphPart.on = on;
            function on() {
                graphPart.beginUpdate = enterModification = enterModificationReal;
                graphPart.endUpdate = exitModification = exitModificationReal;
                recordLinkChange = recordLinkChangeReal;
                recordNodeChange = recordNodeChangeReal;
                graphPart.on = realOn;
                return realOn.apply(graphPart, arguments);
            }
        }
        function recordLinkChangeReal(link, changeType) {
            changes.push({
                link: link,
                changeType: changeType
            });
        }
        function recordNodeChangeReal(node, changeType) {
            changes.push({
                node: node,
                changeType: changeType
            });
        }
        function addNode(nodeId, data) {
            if (nodeId === undefined) {
                throw new Error('Invalid node identifier');
            }
            enterModification();
            var node = getNode(nodeId);
            if (!node) {
                node = new Node1(nodeId, data);
                recordNodeChange(node, 'add');
            } else {
                node.data = data;
                recordNodeChange(node, 'update');
            }
            nodes.set(nodeId, node);
            exitModification();
            return node;
        }
        function getNode(nodeId) {
            return nodes.get(nodeId);
        }
        function removeNode(nodeId) {
            var node = getNode(nodeId);
            if (!node) {
                return false;
            }
            enterModification();
            var prevLinks = node.links;
            if (prevLinks) {
                node.links = null;
                for(var i = 0; i < prevLinks.length; ++i){
                    removeLink(prevLinks[i]);
                }
            }
            nodes.delete(nodeId);
            recordNodeChange(node, 'remove');
            exitModification();
            return true;
        }
        function addLink(fromId, toId, data) {
            enterModification();
            var fromNode = getNode(fromId) || addNode(fromId);
            var toNode = getNode(toId) || addNode(toId);
            var link = createLink(fromId, toId, data);
            links.push(link);
            addLinkToNode(fromNode, link);
            if (fromId !== toId) {
                addLinkToNode(toNode, link);
            }
            recordLinkChange(link, 'add');
            exitModification();
            return link;
        }
        function createSingleLink(fromId, toId, data) {
            var linkId = makeLinkId(fromId, toId);
            return new Link(fromId, toId, data, linkId);
        }
        function createUniqueLink(fromId, toId, data) {
            var linkId = makeLinkId(fromId, toId);
            var isMultiEdge = multiEdges.hasOwnProperty(linkId);
            if (isMultiEdge || getLink(fromId, toId)) {
                if (!isMultiEdge) {
                    multiEdges[linkId] = 0;
                }
                var suffix = '@' + ++multiEdges[linkId];
                linkId = makeLinkId(fromId + suffix, toId + suffix);
            }
            return new Link(fromId, toId, data, linkId);
        }
        function getNodeCount() {
            return nodes.size;
        }
        function getLinkCount() {
            return links.length;
        }
        function getLinks(nodeId) {
            var node = getNode(nodeId);
            return node ? node.links : null;
        }
        function removeLink(link) {
            if (!link) {
                return false;
            }
            var idx = indexOfElementInArray(link, links);
            if (idx < 0) {
                return false;
            }
            enterModification();
            links.splice(idx, 1);
            var fromNode = getNode(link.fromId);
            var toNode = getNode(link.toId);
            if (fromNode) {
                idx = indexOfElementInArray(link, fromNode.links);
                if (idx >= 0) {
                    fromNode.links.splice(idx, 1);
                }
            }
            if (toNode) {
                idx = indexOfElementInArray(link, toNode.links);
                if (idx >= 0) {
                    toNode.links.splice(idx, 1);
                }
            }
            recordLinkChange(link, 'remove');
            exitModification();
            return true;
        }
        function getLink(fromNodeId, toNodeId) {
            var node = getNode(fromNodeId), i;
            if (!node || !node.links) {
                return null;
            }
            for(i = 0; i < node.links.length; ++i){
                var link = node.links[i];
                if (link.fromId === fromNodeId && link.toId === toNodeId) {
                    return link;
                }
            }
            return null;
        }
        function clear() {
            enterModification();
            forEachNode(function(node) {
                removeNode(node.id);
            });
            exitModification();
        }
        function forEachLink(callback) {
            var i, length;
            if (typeof callback === 'function') {
                for(i = 0, length = links.length; i < length; ++i){
                    callback(links[i]);
                }
            }
        }
        function forEachLinkedNode(nodeId, callback, oriented) {
            var node = getNode(nodeId);
            if (node && node.links && typeof callback === 'function') {
                if (oriented) {
                    return forEachOrientedLink(node.links, nodeId, callback);
                } else {
                    return forEachNonOrientedLink(node.links, nodeId, callback);
                }
            }
        }
        function forEachNonOrientedLink(links1, nodeId, callback) {
            var quitFast;
            for(var i = 0; i < links1.length; ++i){
                var link = links1[i];
                var linkedNodeId = link.fromId === nodeId ? link.toId : link.fromId;
                quitFast = callback(nodes.get(linkedNodeId), link);
                if (quitFast) {
                    return true;
                }
            }
        }
        function forEachOrientedLink(links1, nodeId, callback) {
            var quitFast;
            for(var i = 0; i < links1.length; ++i){
                var link = links1[i];
                if (link.fromId === nodeId) {
                    quitFast = callback(nodes.get(link.toId), link);
                    if (quitFast) {
                        return true;
                    }
                }
            }
        }
        function noop() {
        }
        function enterModificationReal() {
            suspendEvents += 1;
        }
        function exitModificationReal() {
            suspendEvents -= 1;
            if (suspendEvents === 0 && changes.length > 0) {
                graphPart.fire('changed', changes);
                changes.length = 0;
            }
        }
        function forEachNode(callback) {
            if (typeof callback !== 'function') {
                throw new Error('Function is expected to iterate over graph nodes. You passed ' + callback);
            }
            var valuesIterator = nodes.values();
            var nextValue = valuesIterator.next();
            while(!nextValue.done){
                if (callback(nextValue.value)) {
                    return true;
                }
                nextValue = valuesIterator.next();
            }
        }
    }
    function indexOfElementInArray(element, array) {
        if (!array) return -1;
        if (array.indexOf) {
            return array.indexOf(element);
        }
        var len = array.length, i;
        for(i = 0; i < len; i += 1){
            if (array[i] === element) {
                return i;
            }
        }
        return -1;
    }
    function Node1(id, data) {
        (this || _global).id = id;
        (this || _global).links = null;
        (this || _global).data = data;
    }
    function addLinkToNode(node, link) {
        if (node.links) {
            node.links.push(link);
        } else {
            node.links = [
                link
            ];
        }
    }
    function Link(fromId, toId, data, id) {
        (this || _global).fromId = fromId;
        (this || _global).toId = toId;
        (this || _global).data = data;
        (this || _global).id = id;
    }
    function makeLinkId(fromId, toId) {
        return fromId.toString() + '👉 ' + toId.toString();
    }
    return exports1;
}
const __default = dew1();
var Status;
(function(Status1) {
    Status1[Status1["Continue"] = 100] = "Continue";
    Status1[Status1["SwitchingProtocols"] = 101] = "SwitchingProtocols";
    Status1[Status1["Processing"] = 102] = "Processing";
    Status1[Status1["EarlyHints"] = 103] = "EarlyHints";
    Status1[Status1["OK"] = 200] = "OK";
    Status1[Status1["Created"] = 201] = "Created";
    Status1[Status1["Accepted"] = 202] = "Accepted";
    Status1[Status1["NonAuthoritativeInfo"] = 203] = "NonAuthoritativeInfo";
    Status1[Status1["NoContent"] = 204] = "NoContent";
    Status1[Status1["ResetContent"] = 205] = "ResetContent";
    Status1[Status1["PartialContent"] = 206] = "PartialContent";
    Status1[Status1["MultiStatus"] = 207] = "MultiStatus";
    Status1[Status1["AlreadyReported"] = 208] = "AlreadyReported";
    Status1[Status1["IMUsed"] = 226] = "IMUsed";
    Status1[Status1["MultipleChoices"] = 300] = "MultipleChoices";
    Status1[Status1["MovedPermanently"] = 301] = "MovedPermanently";
    Status1[Status1["Found"] = 302] = "Found";
    Status1[Status1["SeeOther"] = 303] = "SeeOther";
    Status1[Status1["NotModified"] = 304] = "NotModified";
    Status1[Status1["UseProxy"] = 305] = "UseProxy";
    Status1[Status1["TemporaryRedirect"] = 307] = "TemporaryRedirect";
    Status1[Status1["PermanentRedirect"] = 308] = "PermanentRedirect";
    Status1[Status1["BadRequest"] = 400] = "BadRequest";
    Status1[Status1["Unauthorized"] = 401] = "Unauthorized";
    Status1[Status1["PaymentRequired"] = 402] = "PaymentRequired";
    Status1[Status1["Forbidden"] = 403] = "Forbidden";
    Status1[Status1["NotFound"] = 404] = "NotFound";
    Status1[Status1["MethodNotAllowed"] = 405] = "MethodNotAllowed";
    Status1[Status1["NotAcceptable"] = 406] = "NotAcceptable";
    Status1[Status1["ProxyAuthRequired"] = 407] = "ProxyAuthRequired";
    Status1[Status1["RequestTimeout"] = 408] = "RequestTimeout";
    Status1[Status1["Conflict"] = 409] = "Conflict";
    Status1[Status1["Gone"] = 410] = "Gone";
    Status1[Status1["LengthRequired"] = 411] = "LengthRequired";
    Status1[Status1["PreconditionFailed"] = 412] = "PreconditionFailed";
    Status1[Status1["RequestEntityTooLarge"] = 413] = "RequestEntityTooLarge";
    Status1[Status1["RequestURITooLong"] = 414] = "RequestURITooLong";
    Status1[Status1["UnsupportedMediaType"] = 415] = "UnsupportedMediaType";
    Status1[Status1["RequestedRangeNotSatisfiable"] = 416] = "RequestedRangeNotSatisfiable";
    Status1[Status1["ExpectationFailed"] = 417] = "ExpectationFailed";
    Status1[Status1["Teapot"] = 418] = "Teapot";
    Status1[Status1["MisdirectedRequest"] = 421] = "MisdirectedRequest";
    Status1[Status1["UnprocessableEntity"] = 422] = "UnprocessableEntity";
    Status1[Status1["Locked"] = 423] = "Locked";
    Status1[Status1["FailedDependency"] = 424] = "FailedDependency";
    Status1[Status1["TooEarly"] = 425] = "TooEarly";
    Status1[Status1["UpgradeRequired"] = 426] = "UpgradeRequired";
    Status1[Status1["PreconditionRequired"] = 428] = "PreconditionRequired";
    Status1[Status1["TooManyRequests"] = 429] = "TooManyRequests";
    Status1[Status1["RequestHeaderFieldsTooLarge"] = 431] = "RequestHeaderFieldsTooLarge";
    Status1[Status1["UnavailableForLegalReasons"] = 451] = "UnavailableForLegalReasons";
    Status1[Status1["InternalServerError"] = 500] = "InternalServerError";
    Status1[Status1["NotImplemented"] = 501] = "NotImplemented";
    Status1[Status1["BadGateway"] = 502] = "BadGateway";
    Status1[Status1["ServiceUnavailable"] = 503] = "ServiceUnavailable";
    Status1[Status1["GatewayTimeout"] = 504] = "GatewayTimeout";
    Status1[Status1["HTTPVersionNotSupported"] = 505] = "HTTPVersionNotSupported";
    Status1[Status1["VariantAlsoNegotiates"] = 506] = "VariantAlsoNegotiates";
    Status1[Status1["InsufficientStorage"] = 507] = "InsufficientStorage";
    Status1[Status1["LoopDetected"] = 508] = "LoopDetected";
    Status1[Status1["NotExtended"] = 510] = "NotExtended";
    Status1[Status1["NetworkAuthenticationRequired"] = 511] = "NetworkAuthenticationRequired";
})(Status || (Status = {
}));
const STATUS_TEXT = new Map([
    [
        Status.Continue,
        "Continue"
    ],
    [
        Status.SwitchingProtocols,
        "Switching Protocols"
    ],
    [
        Status.Processing,
        "Processing"
    ],
    [
        Status.EarlyHints,
        "Early Hints"
    ],
    [
        Status.OK,
        "OK"
    ],
    [
        Status.Created,
        "Created"
    ],
    [
        Status.Accepted,
        "Accepted"
    ],
    [
        Status.NonAuthoritativeInfo,
        "Non-Authoritative Information"
    ],
    [
        Status.NoContent,
        "No Content"
    ],
    [
        Status.ResetContent,
        "Reset Content"
    ],
    [
        Status.PartialContent,
        "Partial Content"
    ],
    [
        Status.MultiStatus,
        "Multi-Status"
    ],
    [
        Status.AlreadyReported,
        "Already Reported"
    ],
    [
        Status.IMUsed,
        "IM Used"
    ],
    [
        Status.MultipleChoices,
        "Multiple Choices"
    ],
    [
        Status.MovedPermanently,
        "Moved Permanently"
    ],
    [
        Status.Found,
        "Found"
    ],
    [
        Status.SeeOther,
        "See Other"
    ],
    [
        Status.NotModified,
        "Not Modified"
    ],
    [
        Status.UseProxy,
        "Use Proxy"
    ],
    [
        Status.TemporaryRedirect,
        "Temporary Redirect"
    ],
    [
        Status.PermanentRedirect,
        "Permanent Redirect"
    ],
    [
        Status.BadRequest,
        "Bad Request"
    ],
    [
        Status.Unauthorized,
        "Unauthorized"
    ],
    [
        Status.PaymentRequired,
        "Payment Required"
    ],
    [
        Status.Forbidden,
        "Forbidden"
    ],
    [
        Status.NotFound,
        "Not Found"
    ],
    [
        Status.MethodNotAllowed,
        "Method Not Allowed"
    ],
    [
        Status.NotAcceptable,
        "Not Acceptable"
    ],
    [
        Status.ProxyAuthRequired,
        "Proxy Authentication Required"
    ],
    [
        Status.RequestTimeout,
        "Request Timeout"
    ],
    [
        Status.Conflict,
        "Conflict"
    ],
    [
        Status.Gone,
        "Gone"
    ],
    [
        Status.LengthRequired,
        "Length Required"
    ],
    [
        Status.PreconditionFailed,
        "Precondition Failed"
    ],
    [
        Status.RequestEntityTooLarge,
        "Request Entity Too Large"
    ],
    [
        Status.RequestURITooLong,
        "Request URI Too Long"
    ],
    [
        Status.UnsupportedMediaType,
        "Unsupported Media Type"
    ],
    [
        Status.RequestedRangeNotSatisfiable,
        "Requested Range Not Satisfiable"
    ],
    [
        Status.ExpectationFailed,
        "Expectation Failed"
    ],
    [
        Status.Teapot,
        "I'm a teapot"
    ],
    [
        Status.MisdirectedRequest,
        "Misdirected Request"
    ],
    [
        Status.UnprocessableEntity,
        "Unprocessable Entity"
    ],
    [
        Status.Locked,
        "Locked"
    ],
    [
        Status.FailedDependency,
        "Failed Dependency"
    ],
    [
        Status.TooEarly,
        "Too Early"
    ],
    [
        Status.UpgradeRequired,
        "Upgrade Required"
    ],
    [
        Status.PreconditionRequired,
        "Precondition Required"
    ],
    [
        Status.TooManyRequests,
        "Too Many Requests"
    ],
    [
        Status.RequestHeaderFieldsTooLarge,
        "Request Header Fields Too Large"
    ],
    [
        Status.UnavailableForLegalReasons,
        "Unavailable For Legal Reasons"
    ],
    [
        Status.InternalServerError,
        "Internal Server Error"
    ],
    [
        Status.NotImplemented,
        "Not Implemented"
    ],
    [
        Status.BadGateway,
        "Bad Gateway"
    ],
    [
        Status.ServiceUnavailable,
        "Service Unavailable"
    ],
    [
        Status.GatewayTimeout,
        "Gateway Timeout"
    ],
    [
        Status.HTTPVersionNotSupported,
        "HTTP Version Not Supported"
    ],
    [
        Status.VariantAlsoNegotiates,
        "Variant Also Negotiates"
    ],
    [
        Status.InsufficientStorage,
        "Insufficient Storage"
    ],
    [
        Status.LoopDetected,
        "Loop Detected"
    ],
    [
        Status.NotExtended,
        "Not Extended"
    ],
    [
        Status.NetworkAuthenticationRequired,
        "Network Authentication Required"
    ], 
]);
const noColor = globalThis.Deno?.noColor ?? true;
let enabled = !noColor;
function code(open, close) {
    return {
        open: `\x1b[${open.join(";")}m`,
        close: `\x1b[${close}m`,
        regexp: new RegExp(`\\x1b\\[${close}m`, "g")
    };
}
function run(str, code1) {
    return enabled ? `${code1.open}${str.replace(code1.regexp, code1.open)}${code1.close}` : str;
}
function bold(str) {
    return run(str, code([
        1
    ], 22));
}
function underline(str) {
    return run(str, code([
        4
    ], 24));
}
function green(str) {
    return run(str, code([
        32
    ], 39));
}
function brightBlack(str) {
    return run(str, code([
        90
    ], 39));
}
function brightRed(str) {
    return run(str, code([
        91
    ], 39));
}
function brightGreen(str) {
    return run(str, code([
        92
    ], 39));
}
function brightYellow(str) {
    return run(str, code([
        93
    ], 39));
}
function brightBlue(str) {
    return run(str, code([
        94
    ], 39));
}
function brightMagenta(str) {
    return run(str, code([
        95
    ], 39));
}
function brightCyan(str) {
    return run(str, code([
        96
    ], 39));
}
function clampAndTruncate(n, max = 255, min = 0) {
    return Math.trunc(Math.max(Math.min(n, max), min));
}
const ANSI_PATTERN = new RegExp([
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))", 
].join("|"), "g");
function stripColor(string) {
    return string.replace(ANSI_PATTERN, "");
}
function Timeout(timeout = 10000) {
    return function(target, propertyKey, descriptor) {
        const originalFn = descriptor.value;
        descriptor.value = async function(...args) {
            try {
                return await timeoutAsync.apply(this, [
                    originalFn,
                    args,
                    timeout, 
                ]);
            } catch (e) {
                if (e.message === "timeout") {
                    e.message = `${bold("Timeout (" + String(timeout) + "ms")}) exceeded for ${brightMagenta(propertyKey + "(…)")}`;
                    Error.captureStackTrace(e, descriptor.value);
                }
                throw e;
            }
        };
        return descriptor;
    };
}
function timeoutAsync(fn, args, timeout) {
    let id;
    return Promise.race([
        new Promise((_, reject)=>{
            id = setTimeout(()=>{
                clearTimeout(id);
                reject(new Error("timeout"));
            }, timeout);
        }),
        fn.apply(this, args), 
    ]).then((result)=>{
        clearTimeout(id);
        return result;
    });
}
var exports2 = {
}, _dewExec2 = false;
function dew2() {
    if (_dewExec2) return exports2;
    _dewExec2 = true;
    function Denque(array, options) {
        var options = options || {
        };
        this._head = 0;
        this._tail = 0;
        this._capacity = options.capacity;
        this._capacityMask = 3;
        this._list = new Array(4);
        if (Array.isArray(array)) {
            this._fromArray(array);
        }
    }
    Denque.prototype.peekAt = function peekAt(index) {
        var i = index;
        if (i !== (i | 0)) {
            return void 0;
        }
        var len = this.size();
        if (i >= len || i < -len) return undefined;
        if (i < 0) i += len;
        i = this._head + i & this._capacityMask;
        return this._list[i];
    };
    Denque.prototype.get = function get(i) {
        return this.peekAt(i);
    };
    Denque.prototype.peek = function peek() {
        if (this._head === this._tail) return undefined;
        return this._list[this._head];
    };
    Denque.prototype.peekFront = function peekFront() {
        return this.peek();
    };
    Denque.prototype.peekBack = function peekBack() {
        return this.peekAt(-1);
    };
    Object.defineProperty(Denque.prototype, 'length', {
        get: function length() {
            return this.size();
        }
    });
    Denque.prototype.size = function size() {
        if (this._head === this._tail) return 0;
        if (this._head < this._tail) return this._tail - this._head;
        else return this._capacityMask + 1 - (this._head - this._tail);
    };
    Denque.prototype.unshift = function unshift(item) {
        if (item === undefined) return this.size();
        var len = this._list.length;
        this._head = this._head - 1 + len & this._capacityMask;
        this._list[this._head] = item;
        if (this._tail === this._head) this._growArray();
        if (this._capacity && this.size() > this._capacity) this.pop();
        if (this._head < this._tail) return this._tail - this._head;
        else return this._capacityMask + 1 - (this._head - this._tail);
    };
    Denque.prototype.shift = function shift() {
        var head = this._head;
        if (head === this._tail) return undefined;
        var item = this._list[head];
        this._list[head] = undefined;
        this._head = head + 1 & this._capacityMask;
        if (head < 2 && this._tail > 10000 && this._tail <= this._list.length >>> 2) this._shrinkArray();
        return item;
    };
    Denque.prototype.push = function push(item) {
        if (item === undefined) return this.size();
        var tail = this._tail;
        this._list[tail] = item;
        this._tail = tail + 1 & this._capacityMask;
        if (this._tail === this._head) {
            this._growArray();
        }
        if (this._capacity && this.size() > this._capacity) {
            this.shift();
        }
        if (this._head < this._tail) return this._tail - this._head;
        else return this._capacityMask + 1 - (this._head - this._tail);
    };
    Denque.prototype.pop = function pop() {
        var tail = this._tail;
        if (tail === this._head) return undefined;
        var len = this._list.length;
        this._tail = tail - 1 + len & this._capacityMask;
        var item = this._list[this._tail];
        this._list[this._tail] = undefined;
        if (this._head < 2 && tail > 10000 && tail <= len >>> 2) this._shrinkArray();
        return item;
    };
    Denque.prototype.removeOne = function removeOne(index) {
        var i = index;
        if (i !== (i | 0)) {
            return void 0;
        }
        if (this._head === this._tail) return void 0;
        var size1 = this.size();
        var len = this._list.length;
        if (i >= size1 || i < -size1) return void 0;
        if (i < 0) i += size1;
        i = this._head + i & this._capacityMask;
        var item = this._list[i];
        var k;
        if (index < size1 / 2) {
            for(k = index; k > 0; k--){
                this._list[i] = this._list[i = i - 1 + len & this._capacityMask];
            }
            this._list[i] = void 0;
            this._head = this._head + 1 + len & this._capacityMask;
        } else {
            for(k = size1 - 1 - index; k > 0; k--){
                this._list[i] = this._list[i = i + 1 + len & this._capacityMask];
            }
            this._list[i] = void 0;
            this._tail = this._tail - 1 + len & this._capacityMask;
        }
        return item;
    };
    Denque.prototype.remove = function remove(index, count) {
        var i = index;
        var removed;
        var del_count = count;
        if (i !== (i | 0)) {
            return void 0;
        }
        if (this._head === this._tail) return void 0;
        var size1 = this.size();
        var len = this._list.length;
        if (i >= size1 || i < -size1 || count < 1) return void 0;
        if (i < 0) i += size1;
        if (count === 1 || !count) {
            removed = new Array(1);
            removed[0] = this.removeOne(i);
            return removed;
        }
        if (i === 0 && i + count >= size1) {
            removed = this.toArray();
            this.clear();
            return removed;
        }
        if (i + count > size1) count = size1 - i;
        var k;
        removed = new Array(count);
        for(k = 0; k < count; k++){
            removed[k] = this._list[this._head + i + k & this._capacityMask];
        }
        i = this._head + i & this._capacityMask;
        if (index + count === size1) {
            this._tail = this._tail - count + len & this._capacityMask;
            for(k = count; k > 0; k--){
                this._list[i = i + 1 + len & this._capacityMask] = void 0;
            }
            return removed;
        }
        if (index === 0) {
            this._head = this._head + count + len & this._capacityMask;
            for(k = count - 1; k > 0; k--){
                this._list[i = i + 1 + len & this._capacityMask] = void 0;
            }
            return removed;
        }
        if (i < size1 / 2) {
            this._head = this._head + index + count + len & this._capacityMask;
            for(k = index; k > 0; k--){
                this.unshift(this._list[i = i - 1 + len & this._capacityMask]);
            }
            i = this._head - 1 + len & this._capacityMask;
            while(del_count > 0){
                this._list[i = i - 1 + len & this._capacityMask] = void 0;
                del_count--;
            }
            if (index < 0) this._tail = i;
        } else {
            this._tail = i;
            i = i + count + len & this._capacityMask;
            for(k = size1 - (count + index); k > 0; k--){
                this.push(this._list[i++]);
            }
            i = this._tail;
            while(del_count > 0){
                this._list[i = i + 1 + len & this._capacityMask] = void 0;
                del_count--;
            }
        }
        if (this._head < 2 && this._tail > 10000 && this._tail <= len >>> 2) this._shrinkArray();
        return removed;
    };
    Denque.prototype.splice = function splice(index, count) {
        var i = index;
        if (i !== (i | 0)) {
            return void 0;
        }
        var size1 = this.size();
        if (i < 0) i += size1;
        if (i > size1) return void 0;
        if (arguments.length > 2) {
            var k;
            var temp;
            var removed;
            var arg_len = arguments.length;
            var len = this._list.length;
            var arguments_index = 2;
            if (!size1 || i < size1 / 2) {
                temp = new Array(i);
                for(k = 0; k < i; k++){
                    temp[k] = this._list[this._head + k & this._capacityMask];
                }
                if (count === 0) {
                    removed = [];
                    if (i > 0) {
                        this._head = this._head + i + len & this._capacityMask;
                    }
                } else {
                    removed = this.remove(i, count);
                    this._head = this._head + i + len & this._capacityMask;
                }
                while(arg_len > arguments_index){
                    this.unshift(arguments[--arg_len]);
                }
                for(k = i; k > 0; k--){
                    this.unshift(temp[k - 1]);
                }
            } else {
                temp = new Array(size1 - (i + count));
                var leng = temp.length;
                for(k = 0; k < leng; k++){
                    temp[k] = this._list[this._head + i + count + k & this._capacityMask];
                }
                if (count === 0) {
                    removed = [];
                    if (i != size1) {
                        this._tail = this._head + i + len & this._capacityMask;
                    }
                } else {
                    removed = this.remove(i, count);
                    this._tail = this._tail - leng + len & this._capacityMask;
                }
                while(arguments_index < arg_len){
                    this.push(arguments[arguments_index++]);
                }
                for(k = 0; k < leng; k++){
                    this.push(temp[k]);
                }
            }
            return removed;
        } else {
            return this.remove(i, count);
        }
    };
    Denque.prototype.clear = function clear() {
        this._head = 0;
        this._tail = 0;
    };
    Denque.prototype.isEmpty = function isEmpty() {
        return this._head === this._tail;
    };
    Denque.prototype.toArray = function toArray() {
        return this._copyArray(false);
    };
    Denque.prototype._fromArray = function _fromArray(array) {
        for(var i = 0; i < array.length; i++)this.push(array[i]);
    };
    Denque.prototype._copyArray = function _copyArray(fullCopy) {
        var newArray = [];
        var list = this._list;
        var len = list.length;
        var i;
        if (fullCopy || this._head > this._tail) {
            for(i = this._head; i < len; i++)newArray.push(list[i]);
            for(i = 0; i < this._tail; i++)newArray.push(list[i]);
        } else {
            for(i = this._head; i < this._tail; i++)newArray.push(list[i]);
        }
        return newArray;
    };
    Denque.prototype._growArray = function _growArray() {
        if (this._head) {
            this._list = this._copyArray(true);
            this._head = 0;
        }
        this._tail = this._list.length;
        this._list.length *= 2;
        this._capacityMask = this._capacityMask << 1 | 1;
    };
    Denque.prototype._shrinkArray = function _shrinkArray() {
        this._list.length >>>= 1;
        this._capacityMask >>>= 1;
    };
    exports2 = Denque;
    return exports2;
}
const __default1 = dew2();
const sleep = (ms)=>new Promise((resolve)=>setTimeout(resolve, ms)
    )
;
class LruCache {
    values = new Map();
    maxEntries = 500;
    get(key) {
        const entry = this.values.get(key);
        if (entry !== undefined) {
            this.values.delete(key);
            this.values.set(key, entry);
        }
        return entry;
    }
    has(key) {
        return this.values.has(key);
    }
    put(key, value) {
        if (this.values.size >= this.maxEntries) {
            const keyToDelete = this.values.keys().next().value;
            this.values.delete(keyToDelete);
        }
        this.values.set(key, value);
    }
}
var BackOffPolicy;
(function(BackOffPolicy1) {
    BackOffPolicy1["FixedBackOffPolicy"] = "FixedBackOffPolicy";
    BackOffPolicy1["ExponentialBackOffPolicy"] = "ExponentialBackOffPolicy";
})(BackOffPolicy || (BackOffPolicy = {
}));
function Retry(options = {
    maxAttempts: 3
}) {
    return function(target, propertyKey, descriptor) {
        const originalFn = descriptor.value;
        if (options.backOffPolicy === BackOffPolicy.ExponentialBackOffPolicy) {
            !options.backOff && (options.backOff = 1000);
            options.exponentialOption = {
                ...{
                    maxInterval: 2000,
                    multiplier: 2
                },
                ...options.exponentialOption
            };
        }
        descriptor.value = async function(...args) {
            try {
                return await retryAsync.apply(this, [
                    originalFn,
                    args,
                    options.maxAttempts,
                    options.backOff,
                    options.doRetry, 
                ]);
            } catch (e) {
                if (e.message === "maxAttempts") {
                    e.code = "429";
                    e.message = `${brightRed("Failed")} for ${brightMagenta(propertyKey + "(…)")} for ${brightYellow(options.maxAttempts.toString())} times.`;
                }
                throw e;
            }
        };
        return descriptor;
    };
    async function retryAsync(fn, args, maxAttempts, backOff, doRetry) {
        try {
            return await fn.apply(this, args);
        } catch (e) {
            if ((--maxAttempts) < 0) {
                console.error(e?.message);
                throw new Error("maxAttempts");
            } else if (doRetry && !doRetry(e)) {
                throw e;
            }
            if (backOff) {
                await sleep(backOff);
                if (options.backOffPolicy === BackOffPolicy.ExponentialBackOffPolicy && options.exponentialOption) {
                    const newBackOff = backOff * options.exponentialOption.multiplier;
                    backOff = newBackOff > options.exponentialOption.maxInterval ? options.exponentialOption.maxInterval : newBackOff;
                }
            }
            return retryAsync.apply(this, [
                fn,
                args,
                maxAttempts,
                backOff,
                doRetry
            ]);
        }
    }
}
function Trace(options = {
    stack: false
}) {
    return function(target, propertyKey, descriptor) {
        const originalFn = descriptor.value;
        let lastFrom;
        descriptor.value = async function(...args) {
            const e = new Error();
            Error.captureStackTrace(e, options.stack ? undefined : descriptor.value);
            const from = options.stack ? "\n" + e.stack?.split("\n").slice(1).join("\n") : e.stack?.split("\n").slice(1)[0]?.replace("at", "").trim();
            const p1 = performance.now();
            console.log(`${brightMagenta(propertyKey + "(…)")} ${bold("called")} ${options.stack ? "" : "from"} ${brightCyan((from ?? lastFrom) ?? "unknown")}`);
            if (from) lastFrom = from;
            let result;
            originalFn.constructor.name === "AsyncFunction" ? result = await originalFn.apply(this, args) : result = originalFn.apply(this, args);
            console.log(`${brightMagenta(propertyKey + "(…)")} ${green("ended")} in ${brightYellow((performance.now() - p1).toFixed() + "ms")}`);
            return result;
        };
        return descriptor;
    };
}
function _applyDecoratedDescriptor1(target, property, decorators, descriptor, context) {
    var desc = {
    };
    Object.keys(descriptor).forEach(function(key) {
        desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;
    if ("value" in desc || desc.initializer) {
        desc.writable = true;
    }
    desc = decorators.slice().reverse().reduce(function(desc, decorator) {
        return decorator(target, property, desc) || desc;
    }, desc);
    if (context && desc.initializer !== void 0) {
        desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
        desc.initializer = undefined;
    }
    if (desc.initializer === void 0) {
        Object.defineProperty(target, property, desc);
        desc = null;
    }
    return desc;
}
var _class1, _dec4, _dec5, _dec6, _dec7;
const fetchHeader = {
    headers: {
    }
};
const httpProxy = Deno.env.get("HTTP_PROXY");
if (httpProxy) {
    const url = new URL(httpProxy);
    fetchHeader.headers = {
        "Authorization": `Basic ${btoa(url.username + ":" + url.password)}`
    };
    console.info(`Using HTTP_PROXY (origin="${url.origin}", Authorization="Basic ***...***")`);
}
let EgoGraph = ((_class1 = class EgoGraph {
    static DEFAULT_GRAPH_DEPTH = 1;
    static DEFAULT_SEARCH_PATTERN = " vs ";
    static DEFAULT_GRAPH_RADIUS = 10;
    elapsedMs = 0;
    maxDistance = Number.NEGATIVE_INFINITY;
    constructor(options1 = {
        query: ""
    }){
        this.graph = __default();
        this.query = options1.query;
        this.depth = options1.depth ?? EgoGraph.DEFAULT_GRAPH_DEPTH;
        this.pattern = options1.pattern ?? EgoGraph.DEFAULT_SEARCH_PATTERN;
        this.radius = options1.radius ?? EgoGraph.DEFAULT_GRAPH_RADIUS;
    }
    async fetchAutocomplete(term, maxCount) {
        const q = term + this.pattern;
        const res = await fetch(`http://suggestqueries.google.com/complete/search?&client=firefox&gl=us&hl=en&q=${encodeURIComponent(q)}`, fetchHeader);
        if (res.status === Status.OK) {
            const hits = await res.json();
            const set = new Set();
            for (const hit of hits[1].slice(0, maxCount)){
                hit.split(this.pattern).slice(1).map((t)=>{
                    if (!new RegExp("^[0-9.]+$").test(t)) {
                        set.add(t);
                    }
                });
            }
            return set;
        } else {
            throw new Error(`Fetch error: ${res.status} ${res.statusText}`);
        }
    }
    async build() {
        if (this.query === "") return;
        const t1 = performance.now();
        this.graph.beginUpdate();
        let sources = [
            this.query
        ];
        let distances = [
            0
        ];
        for(let depth = 0; depth < this.depth; depth++){
            const nextSources = [];
            const nextDistances = [];
            for(let i = 0; i < sources.length; i++){
                const srcDistance = distances[i];
                if (srcDistance >= this.radius) continue;
                const src = sources[i];
                const targets = await this.fetchAutocomplete(src, this.radius - srcDistance);
                if (!this.graph.getNode(src)) {
                    this.graph.addNode(src, {
                        count: 1,
                        depth: src === this.query ? 0 : depth + 1
                    });
                }
                let weight = targets.size;
                let distance = 1;
                targets.forEach((target)=>{
                    const dist = srcDistance + distance;
                    if (dist > this.maxDistance) this.maxDistance = dist;
                    const targetNode = this.graph.getNode(target);
                    if (!targetNode) {
                        this.graph.addNode(target, {
                            count: 1,
                            depth: depth + 1
                        });
                        this.graph.addLink(src, target, {
                            distance: dist,
                            weight,
                            query: `${src}${this.pattern}${target}`
                        });
                        nextDistances.push(dist);
                        nextSources.push(target);
                    } else {
                        targetNode.data.count++;
                        const link1 = this.graph.getLink(src, target), link2 = this.graph.getLink(target, src);
                        if (link1 || link2) {
                            link1 ? link1.data.weight += weight : link2.data.weight += weight;
                        } else {
                            this.graph.addLink(src, target, {
                                distance: dist,
                                weight,
                                query: `${src}${this.pattern}${target}`
                            });
                        }
                    }
                    weight -= 1;
                    distance += 1;
                });
            }
            sources = nextSources;
            distances = nextDistances;
        }
        this.graph.endUpdate();
        this.elapsedMs = performance.now() - t1;
    }
    toObject() {
        let maxWeight = Number.NEGATIVE_INFINITY;
        this.graph.forEachLink((link)=>{
            if (link.data.weight > maxWeight) maxWeight = link.data.weight;
        });
        const obj = {
            nodes: [],
            links: [],
            query: this.query,
            depth: this.depth,
            radius: this.radius,
            maxWeight,
            maxDistance: this.maxDistance,
            pattern: this.pattern,
            elapsedMs: this.elapsedMs
        };
        this.graph.forEachNode((node)=>{
            obj.nodes.push({
                id: node.id,
                ...node.data
            });
        });
        this.graph.forEachLink((link)=>{
            obj.links.push({
                source: link.fromId,
                target: link.toId,
                ...link.data
            });
        });
        return obj;
    }
}) || _class1, _dec4 = Timeout(1000), _dec5 = Retry({
    maxAttempts: 3
}), _applyDecoratedDescriptor1(_class1.prototype, "fetchAutocomplete", [
    _dec4,
    _dec5
], Object.getOwnPropertyDescriptor(_class1.prototype, "fetchAutocomplete"), _class1.prototype), _dec6 = Trace(), _dec7 = Timeout(10000), _applyDecoratedDescriptor1(_class1.prototype, "build", [
    _dec6,
    _dec7
], Object.getOwnPropertyDescriptor(_class1.prototype, "build"), _class1.prototype), _class1);
function deferred() {
    let methods;
    const promise = new Promise((resolve, reject)=>{
        methods = {
            resolve,
            reject
        };
    });
    return Object.assign(promise, methods);
}
function emptyReader() {
    return {
        read (_) {
            return Promise.resolve(null);
        }
    };
}
function bodyReader(contentLength, r) {
    let totalRead = 0;
    let finished = false;
    async function read(buf) {
        if (finished) return null;
        let result;
        const remaining = contentLength - totalRead;
        if (remaining >= buf.byteLength) {
            result = await r.read(buf);
        } else {
            const readBuf = buf.subarray(0, remaining);
            result = await r.read(readBuf);
        }
        if (result !== null) {
            totalRead += result;
        }
        finished = totalRead === contentLength;
        return result;
    }
    return {
        read
    };
}
function indexOf(source, pat, start = 0) {
    if (start >= source.length) {
        return -1;
    }
    if (start < 0) {
        start = 0;
    }
    const s = pat[0];
    for(let i = start; i < source.length; i++){
        if (source[i] !== s) continue;
        const pin = i;
        let matched = 1;
        let j = i;
        while(matched < pat.length){
            j++;
            if (source[j] !== pat[j - i]) {
                break;
            }
            matched++;
        }
        if (matched === pat.length) {
            return i;
        }
    }
    return -1;
}
function concat(...buf) {
    let length = 0;
    for (const b of buf){
        length += b.length;
    }
    const output = new Uint8Array(length);
    let index = 0;
    for (const b1 of buf){
        output.set(b1, index);
        index += b1.length;
    }
    return output;
}
function copy(src, dst, off = 0) {
    off = Math.max(0, Math.min(off, dst.byteLength));
    const dstBytesAvailable = dst.byteLength - off;
    if (src.byteLength > dstBytesAvailable) {
        src = src.subarray(0, dstBytesAvailable);
    }
    dst.set(src, off);
    return src.byteLength;
}
const invalidHeaderCharRegex = /[^\t\x20-\x7e\x80-\xff]/g;
const encoder = new TextEncoder();
function encode(input) {
    return encoder.encode(input);
}
const decoder = new TextDecoder();
function decode(input) {
    return decoder.decode(input);
}
function str(buf) {
    if (buf == null) {
        return "";
    } else {
        return decode(buf);
    }
}
function charCode(s) {
    return s.charCodeAt(0);
}
class TextProtoReader {
    constructor(r1){
        this.r = r1;
    }
    async readLine() {
        const s = await this.readLineSlice();
        if (s === null) return null;
        return str(s);
    }
    async readMIMEHeader() {
        const m = new Headers();
        let line;
        let buf = await this.r.peek(1);
        if (buf === null) {
            return null;
        } else if (buf[0] == charCode(" ") || buf[0] == charCode("\t")) {
            line = await this.readLineSlice();
        }
        buf = await this.r.peek(1);
        if (buf === null) {
            throw new Deno.errors.UnexpectedEof();
        } else if (buf[0] == charCode(" ") || buf[0] == charCode("\t")) {
            throw new Deno.errors.InvalidData(`malformed MIME header initial line: ${str(line)}`);
        }
        while(true){
            const kv = await this.readLineSlice();
            if (kv === null) throw new Deno.errors.UnexpectedEof();
            if (kv.byteLength === 0) return m;
            let i = kv.indexOf(charCode(":"));
            if (i < 0) {
                throw new Deno.errors.InvalidData(`malformed MIME header line: ${str(kv)}`);
            }
            const key = str(kv.subarray(0, i));
            if (key == "") {
                continue;
            }
            i++;
            while(i < kv.byteLength && (kv[i] == charCode(" ") || kv[i] == charCode("\t"))){
                i++;
            }
            const value = str(kv.subarray(i)).replace(invalidHeaderCharRegex, encodeURI);
            try {
                m.append(key, value);
            } catch  {
            }
        }
    }
    async readLineSlice() {
        let line;
        while(true){
            const r1 = await this.r.readLine();
            if (r1 === null) return null;
            const { line: l , more  } = r1;
            if (!line && !more) {
                if (this.skipSpace(l) === 0) {
                    return new Uint8Array(0);
                }
                return l;
            }
            line = line ? concat(line, l) : l;
            if (!more) {
                break;
            }
        }
        return line;
    }
    skipSpace(l) {
        let n = 0;
        for(let i = 0; i < l.length; i++){
            if (l[i] === charCode(" ") || l[i] === charCode("\t")) {
                continue;
            }
            n++;
        }
        return n;
    }
}
class DenoStdInternalError extends Error {
    constructor(message1){
        super(message1);
        this.name = "DenoStdInternalError";
    }
}
function assert(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError(msg);
    }
}
function chunkedBodyReader(h, r1) {
    const tp = new TextProtoReader(r1);
    let finished = false;
    const chunks = [];
    async function read(buf) {
        if (finished) return null;
        const [chunk] = chunks;
        if (chunk) {
            const chunkRemaining = chunk.data.byteLength - chunk.offset;
            const readLength = Math.min(chunkRemaining, buf.byteLength);
            for(let i = 0; i < readLength; i++){
                buf[i] = chunk.data[chunk.offset + i];
            }
            chunk.offset += readLength;
            if (chunk.offset === chunk.data.byteLength) {
                chunks.shift();
                if (await tp.readLine() === null) {
                    throw new Deno.errors.UnexpectedEof();
                }
            }
            return readLength;
        }
        const line = await tp.readLine();
        if (line === null) throw new Deno.errors.UnexpectedEof();
        const [chunkSizeString] = line.split(";");
        const chunkSize = parseInt(chunkSizeString, 16);
        if (Number.isNaN(chunkSize) || chunkSize < 0) {
            throw new Deno.errors.InvalidData("Invalid chunk size");
        }
        if (chunkSize > 0) {
            if (chunkSize > buf.byteLength) {
                let eof = await r1.readFull(buf);
                if (eof === null) {
                    throw new Deno.errors.UnexpectedEof();
                }
                const restChunk = new Uint8Array(chunkSize - buf.byteLength);
                eof = await r1.readFull(restChunk);
                if (eof === null) {
                    throw new Deno.errors.UnexpectedEof();
                } else {
                    chunks.push({
                        offset: 0,
                        data: restChunk
                    });
                }
                return buf.byteLength;
            } else {
                const bufToFill = buf.subarray(0, chunkSize);
                const eof = await r1.readFull(bufToFill);
                if (eof === null) {
                    throw new Deno.errors.UnexpectedEof();
                }
                if (await tp.readLine() === null) {
                    throw new Deno.errors.UnexpectedEof();
                }
                return chunkSize;
            }
        } else {
            assert(chunkSize === 0);
            if (await r1.readLine() === null) {
                throw new Deno.errors.UnexpectedEof();
            }
            await readTrailers(h, r1);
            finished = true;
            return null;
        }
    }
    return {
        read
    };
}
function isProhibidedForTrailer(key) {
    const s = new Set([
        "transfer-encoding",
        "content-length",
        "trailer"
    ]);
    return s.has(key.toLowerCase());
}
async function readTrailers(headers, r1) {
    const trailers = parseTrailer(headers.get("trailer"));
    if (trailers == null) return;
    const trailerNames = [
        ...trailers.keys()
    ];
    const tp = new TextProtoReader(r1);
    const result = await tp.readMIMEHeader();
    if (result == null) {
        throw new Deno.errors.InvalidData("Missing trailer header.");
    }
    const undeclared = [
        ...result.keys()
    ].filter((k)=>!trailerNames.includes(k)
    );
    if (undeclared.length > 0) {
        throw new Deno.errors.InvalidData(`Undeclared trailers: ${Deno.inspect(undeclared)}.`);
    }
    for (const [k, v] of result){
        headers.append(k, v);
    }
    const missingTrailers = trailerNames.filter((k1)=>!result.has(k1)
    );
    if (missingTrailers.length > 0) {
        throw new Deno.errors.InvalidData(`Missing trailers: ${Deno.inspect(missingTrailers)}.`);
    }
    headers.delete("trailer");
}
function parseTrailer(field) {
    if (field == null) {
        return undefined;
    }
    const trailerNames = field.split(",").map((v)=>v.trim().toLowerCase()
    );
    if (trailerNames.length === 0) {
        throw new Deno.errors.InvalidData("Empty trailer header.");
    }
    const prohibited = trailerNames.filter((k)=>isProhibidedForTrailer(k)
    );
    if (prohibited.length > 0) {
        throw new Deno.errors.InvalidData(`Prohibited trailer names: ${Deno.inspect(prohibited)}.`);
    }
    return new Headers(trailerNames.map((key)=>[
            key,
            ""
        ]
    ));
}
async function writeChunkedBody(w, r1) {
    for await (const chunk of Deno.iter(r1)){
        if (chunk.byteLength <= 0) continue;
        const start = encoder.encode(`${chunk.byteLength.toString(16)}\r\n`);
        const end = encoder.encode("\r\n");
        await w.write(start);
        await w.write(chunk);
        await w.write(end);
        await w.flush();
    }
    const endChunk = encoder.encode("0\r\n\r\n");
    await w.write(endChunk);
}
const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);
class BufferFullError extends Error {
    name = "BufferFullError";
    constructor(partial){
        super("Buffer full");
        this.partial = partial;
    }
}
class PartialReadError extends Deno.errors.UnexpectedEof {
    name = "PartialReadError";
    constructor(){
        super("Encountered UnexpectedEof, data only partially read");
    }
}
class BufReader {
    r = 0;
    w = 0;
    eof = false;
    static create(r, size = 4096) {
        return r instanceof BufReader ? r : new BufReader(r, size);
    }
    constructor(rd1, size1 = 4096){
        if (size1 < 16) {
            size1 = 16;
        }
        this._reset(new Uint8Array(size1), rd1);
    }
    size() {
        return this.buf.byteLength;
    }
    buffered() {
        return this.w - this.r;
    }
    async _fill() {
        if (this.r > 0) {
            this.buf.copyWithin(0, this.r, this.w);
            this.w -= this.r;
            this.r = 0;
        }
        if (this.w >= this.buf.byteLength) {
            throw Error("bufio: tried to fill full buffer");
        }
        for(let i = 100; i > 0; i--){
            const rr = await this.rd.read(this.buf.subarray(this.w));
            if (rr === null) {
                this.eof = true;
                return;
            }
            assert(rr >= 0, "negative read");
            this.w += rr;
            if (rr > 0) {
                return;
            }
        }
        throw new Error(`No progress after ${100} read() calls`);
    }
    reset(r) {
        this._reset(this.buf, r);
    }
    _reset(buf, rd) {
        this.buf = buf;
        this.rd = rd;
        this.eof = false;
    }
    async read(p) {
        let rr = p.byteLength;
        if (p.byteLength === 0) return rr;
        if (this.r === this.w) {
            if (p.byteLength >= this.buf.byteLength) {
                const rr1 = await this.rd.read(p);
                const nread = rr1 ?? 0;
                assert(nread >= 0, "negative read");
                return rr1;
            }
            this.r = 0;
            this.w = 0;
            rr = await this.rd.read(this.buf);
            if (rr === 0 || rr === null) return rr;
            assert(rr >= 0, "negative read");
            this.w += rr;
        }
        const copied = copy(this.buf.subarray(this.r, this.w), p, 0);
        this.r += copied;
        return copied;
    }
    async readFull(p) {
        let bytesRead = 0;
        while(bytesRead < p.length){
            try {
                const rr = await this.read(p.subarray(bytesRead));
                if (rr === null) {
                    if (bytesRead === 0) {
                        return null;
                    } else {
                        throw new PartialReadError();
                    }
                }
                bytesRead += rr;
            } catch (err) {
                err.partial = p.subarray(0, bytesRead);
                throw err;
            }
        }
        return p;
    }
    async readByte() {
        while(this.r === this.w){
            if (this.eof) return null;
            await this._fill();
        }
        const c = this.buf[this.r];
        this.r++;
        return c;
    }
    async readString(delim) {
        if (delim.length !== 1) {
            throw new Error("Delimiter should be a single character");
        }
        const buffer = await this.readSlice(delim.charCodeAt(0));
        if (buffer === null) return null;
        return new TextDecoder().decode(buffer);
    }
    async readLine() {
        let line;
        try {
            line = await this.readSlice(LF);
        } catch (err) {
            let { partial: partial1  } = err;
            assert(partial1 instanceof Uint8Array, "bufio: caught error from `readSlice()` without `partial` property");
            if (!(err instanceof BufferFullError)) {
                throw err;
            }
            if (!this.eof && partial1.byteLength > 0 && partial1[partial1.byteLength - 1] === CR) {
                assert(this.r > 0, "bufio: tried to rewind past start of buffer");
                this.r--;
                partial1 = partial1.subarray(0, partial1.byteLength - 1);
            }
            return {
                line: partial1,
                more: !this.eof
            };
        }
        if (line === null) {
            return null;
        }
        if (line.byteLength === 0) {
            return {
                line,
                more: false
            };
        }
        if (line[line.byteLength - 1] == LF) {
            let drop = 1;
            if (line.byteLength > 1 && line[line.byteLength - 2] === CR) {
                drop = 2;
            }
            line = line.subarray(0, line.byteLength - drop);
        }
        return {
            line,
            more: false
        };
    }
    async readSlice(delim) {
        let s = 0;
        let slice;
        while(true){
            let i = this.buf.subarray(this.r + s, this.w).indexOf(delim);
            if (i >= 0) {
                i += s;
                slice = this.buf.subarray(this.r, this.r + i + 1);
                this.r += i + 1;
                break;
            }
            if (this.eof) {
                if (this.r === this.w) {
                    return null;
                }
                slice = this.buf.subarray(this.r, this.w);
                this.r = this.w;
                break;
            }
            if (this.buffered() >= this.buf.byteLength) {
                this.r = this.w;
                const oldbuf = this.buf;
                const newbuf = this.buf.slice(0);
                this.buf = newbuf;
                throw new BufferFullError(oldbuf);
            }
            s = this.w - this.r;
            try {
                await this._fill();
            } catch (err) {
                err.partial = slice;
                throw err;
            }
        }
        return slice;
    }
    async peek(n) {
        if (n < 0) {
            throw Error("negative count");
        }
        let avail = this.w - this.r;
        while(avail < n && avail < this.buf.byteLength && !this.eof){
            try {
                await this._fill();
            } catch (err) {
                err.partial = this.buf.subarray(this.r, this.w);
                throw err;
            }
            avail = this.w - this.r;
        }
        if (avail === 0 && this.eof) {
            return null;
        } else if (avail < n && this.eof) {
            return this.buf.subarray(this.r, this.r + avail);
        } else if (avail < n) {
            throw new BufferFullError(this.buf.subarray(this.r, this.w));
        }
        return this.buf.subarray(this.r, this.r + n);
    }
}
class AbstractBufBase {
    usedBufferBytes = 0;
    err = null;
    size() {
        return this.buf.byteLength;
    }
    available() {
        return this.buf.byteLength - this.usedBufferBytes;
    }
    buffered() {
        return this.usedBufferBytes;
    }
}
class BufWriter extends AbstractBufBase {
    static create(writer, size = 4096) {
        return writer instanceof BufWriter ? writer : new BufWriter(writer, size);
    }
    constructor(writer1, size2 = 4096){
        super();
        this.writer = writer1;
        if (size2 <= 0) {
            size2 = 4096;
        }
        this.buf = new Uint8Array(size2);
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.writer = w;
    }
    async flush() {
        if (this.err !== null) throw this.err;
        if (this.usedBufferBytes === 0) return;
        try {
            await Deno.writeAll(this.writer, this.buf.subarray(0, this.usedBufferBytes));
        } catch (e) {
            this.err = e;
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    async write(data) {
        if (this.err !== null) throw this.err;
        if (data.length === 0) return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while(data.byteLength > this.available()){
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = await this.writer.write(data);
                } catch (e) {
                    this.err = e;
                    throw e;
                }
            } else {
                numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                await this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
class BufWriterSync extends AbstractBufBase {
    static create(writer, size = 4096) {
        return writer instanceof BufWriterSync ? writer : new BufWriterSync(writer, size);
    }
    constructor(writer2, size3 = 4096){
        super();
        this.writer = writer2;
        if (size3 <= 0) {
            size3 = 4096;
        }
        this.buf = new Uint8Array(size3);
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.writer = w;
    }
    flush() {
        if (this.err !== null) throw this.err;
        if (this.usedBufferBytes === 0) return;
        try {
            Deno.writeAllSync(this.writer, this.buf.subarray(0, this.usedBufferBytes));
        } catch (e) {
            this.err = e;
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    writeSync(data) {
        if (this.err !== null) throw this.err;
        if (data.length === 0) return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while(data.byteLength > this.available()){
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = this.writer.writeSync(data);
                } catch (e) {
                    this.err = e;
                    throw e;
                }
            } else {
                numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
function createLPS(pat) {
    const lps = new Uint8Array(pat.length);
    lps[0] = 0;
    let prefixEnd = 0;
    let i = 1;
    while(i < lps.length){
        if (pat[i] == pat[prefixEnd]) {
            prefixEnd++;
            lps[i] = prefixEnd;
            i++;
        } else if (prefixEnd === 0) {
            lps[i] = 0;
            i++;
        } else {
            prefixEnd = pat[prefixEnd - 1];
        }
    }
    return lps;
}
async function* readDelim(reader, delim) {
    const delimLen = delim.length;
    const delimLPS = createLPS(delim);
    let inputBuffer = new Deno.Buffer();
    const inspectArr = new Uint8Array(Math.max(1024, delimLen + 1));
    let inspectIndex = 0;
    let matchIndex = 0;
    while(true){
        const result = await reader.read(inspectArr);
        if (result === null) {
            yield inputBuffer.bytes();
            return;
        }
        if (result < 0) {
            return;
        }
        const sliceRead = inspectArr.subarray(0, result);
        await Deno.writeAll(inputBuffer, sliceRead);
        let sliceToProcess = inputBuffer.bytes();
        while(inspectIndex < sliceToProcess.length){
            if (sliceToProcess[inspectIndex] === delim[matchIndex]) {
                inspectIndex++;
                matchIndex++;
                if (matchIndex === delimLen) {
                    const matchEnd = inspectIndex - delimLen;
                    const readyBytes = sliceToProcess.subarray(0, matchEnd);
                    const pendingBytes = sliceToProcess.slice(inspectIndex);
                    yield readyBytes;
                    sliceToProcess = pendingBytes;
                    inspectIndex = 0;
                    matchIndex = 0;
                }
            } else {
                if (matchIndex === 0) {
                    inspectIndex++;
                } else {
                    matchIndex = delimLPS[matchIndex - 1];
                }
            }
        }
        inputBuffer = new Deno.Buffer(sliceToProcess);
    }
}
async function* readStringDelim(reader, delim) {
    const encoder1 = new TextEncoder();
    const decoder1 = new TextDecoder();
    for await (const chunk of readDelim(reader, encoder1.encode(delim))){
        yield decoder1.decode(chunk);
    }
}
async function writeTrailers(w, headers, trailers) {
    const trailer = headers.get("trailer");
    if (trailer === null) {
        throw new TypeError("Missing trailer header.");
    }
    const transferEncoding = headers.get("transfer-encoding");
    if (transferEncoding === null || !transferEncoding.match(/^chunked/)) {
        throw new TypeError(`Trailers are only allowed for "transfer-encoding: chunked", got "transfer-encoding: ${transferEncoding}".`);
    }
    const writer3 = BufWriter.create(w);
    const trailerNames = trailer.split(",").map((s)=>s.trim().toLowerCase()
    );
    const prohibitedTrailers = trailerNames.filter((k)=>isProhibidedForTrailer(k)
    );
    if (prohibitedTrailers.length > 0) {
        throw new TypeError(`Prohibited trailer names: ${Deno.inspect(prohibitedTrailers)}.`);
    }
    const undeclared = [
        ...trailers.keys()
    ].filter((k)=>!trailerNames.includes(k)
    );
    if (undeclared.length > 0) {
        throw new TypeError(`Undeclared trailers: ${Deno.inspect(undeclared)}.`);
    }
    for (const [key, value] of trailers){
        await writer3.write(encoder.encode(`${key}: ${value}\r\n`));
    }
    await writer3.write(encoder.encode("\r\n"));
    await writer3.flush();
}
async function writeResponse(w, r2) {
    const protoMajor = 1;
    const protoMinor = 1;
    const statusCode = r2.status || 200;
    const statusText = STATUS_TEXT.get(statusCode);
    const writer3 = BufWriter.create(w);
    if (!statusText) {
        throw new Deno.errors.InvalidData("Bad status code");
    }
    if (!r2.body) {
        r2.body = new Uint8Array();
    }
    if (typeof r2.body === "string") {
        r2.body = encoder.encode(r2.body);
    }
    let out = `HTTP/${1}.${1} ${statusCode} ${statusText}\r\n`;
    const headers = r2.headers ?? new Headers();
    if (r2.body && !headers.get("content-length")) {
        if (r2.body instanceof Uint8Array) {
            out += `content-length: ${r2.body.byteLength}\r\n`;
        } else if (!headers.get("transfer-encoding")) {
            out += "transfer-encoding: chunked\r\n";
        }
    }
    for (const [key, value] of headers){
        out += `${key}: ${value}\r\n`;
    }
    out += `\r\n`;
    const header = encoder.encode(out);
    const n = await writer3.write(header);
    assert(n === header.byteLength);
    if (r2.body instanceof Uint8Array) {
        const n1 = await writer3.write(r2.body);
        assert(n1 === r2.body.byteLength);
    } else if (headers.has("content-length")) {
        const contentLength = headers.get("content-length");
        assert(contentLength != null);
        const bodyLength = parseInt(contentLength);
        const n1 = await Deno.copy(r2.body, writer3);
        assert(n1 === bodyLength);
    } else {
        await writeChunkedBody(writer3, r2.body);
    }
    if (r2.trailers) {
        const t = await r2.trailers();
        await writeTrailers(writer3, headers, t);
    }
    await writer3.flush();
}
function parseHTTPVersion(vers) {
    switch(vers){
        case "HTTP/1.1":
            return [
                1,
                1
            ];
        case "HTTP/1.0":
            return [
                1,
                0
            ];
        default:
            {
                const Big = 1000000;
                if (!vers.startsWith("HTTP/")) {
                    break;
                }
                const dot = vers.indexOf(".");
                if (dot < 0) {
                    break;
                }
                const majorStr = vers.substring(vers.indexOf("/") + 1, dot);
                const major = Number(majorStr);
                if (!Number.isInteger(major) || major < 0 || major > 1000000) {
                    break;
                }
                const minorStr = vers.substring(dot + 1);
                const minor = Number(minorStr);
                if (!Number.isInteger(minor) || minor < 0 || minor > 1000000) {
                    break;
                }
                return [
                    major,
                    minor
                ];
            }
    }
    throw new Error(`malformed HTTP version ${vers}`);
}
class ServerRequest {
    done = deferred();
    _contentLength = undefined;
    get contentLength() {
        if (this._contentLength === undefined) {
            const cl = this.headers.get("content-length");
            if (cl) {
                this._contentLength = parseInt(cl);
                if (Number.isNaN(this._contentLength)) {
                    this._contentLength = null;
                }
            } else {
                this._contentLength = null;
            }
        }
        return this._contentLength;
    }
    _body = null;
    get body() {
        if (!this._body) {
            if (this.contentLength != null) {
                this._body = bodyReader(this.contentLength, this.r);
            } else {
                const transferEncoding = this.headers.get("transfer-encoding");
                if (transferEncoding != null) {
                    const parts = transferEncoding.split(",").map((e)=>e.trim().toLowerCase()
                    );
                    assert(parts.includes("chunked"), 'transfer-encoding must include "chunked" if content-length is not set');
                    this._body = chunkedBodyReader(this.headers, this.r);
                } else {
                    this._body = emptyReader();
                }
            }
        }
        return this._body;
    }
    async respond(r) {
        let err;
        try {
            await writeResponse(this.w, r);
        } catch (e) {
            try {
                this.conn.close();
            } catch  {
            }
            err = e;
        }
        this.done.resolve(err);
        if (err) {
            throw err;
        }
    }
    finalized = false;
    async finalize() {
        if (this.finalized) return;
        const body = this.body;
        const buf = new Uint8Array(1024);
        while(await body.read(buf) !== null){
        }
        this.finalized = true;
    }
}
async function readRequest(conn, bufr) {
    const tp = new TextProtoReader(bufr);
    const firstLine = await tp.readLine();
    if (firstLine === null) return null;
    const headers = await tp.readMIMEHeader();
    if (headers === null) throw new Deno.errors.UnexpectedEof();
    const req = new ServerRequest();
    req.conn = conn;
    req.r = bufr;
    [req.method, req.url, req.proto] = firstLine.split(" ", 3);
    [req.protoMinor, req.protoMajor] = parseHTTPVersion(req.proto);
    req.headers = headers;
    fixLength(req);
    return req;
}
function fixLength(req) {
    const contentLength = req.headers.get("Content-Length");
    if (contentLength) {
        const arrClen = contentLength.split(",");
        if (arrClen.length > 1) {
            const distinct = [
                ...new Set(arrClen.map((e)=>e.trim()
                ))
            ];
            if (distinct.length > 1) {
                throw Error("cannot contain multiple Content-Length headers");
            } else {
                req.headers.set("Content-Length", distinct[0]);
            }
        }
        const c = req.headers.get("Content-Length");
        if (req.method === "HEAD" && c && c !== "0") {
            throw Error("http: method cannot contain a Content-Length");
        }
        if (c && req.headers.has("transfer-encoding")) {
            throw new Error("http: Transfer-Encoding and Content-Length cannot be send together");
        }
    }
}
class MuxAsyncIterator {
    iteratorCount = 0;
    yields = [];
    throws = [];
    signal = deferred();
    add(iterator) {
        ++this.iteratorCount;
        this.callIteratorNext(iterator);
    }
    async callIteratorNext(iterator) {
        try {
            const { value , done  } = await iterator.next();
            if (done) {
                --this.iteratorCount;
            } else {
                this.yields.push({
                    iterator,
                    value
                });
            }
        } catch (e) {
            this.throws.push(e);
        }
        this.signal.resolve();
    }
    async *iterate() {
        while(this.iteratorCount > 0){
            await this.signal;
            for(let i = 0; i < this.yields.length; i++){
                const { iterator , value  } = this.yields[i];
                yield value;
                this.callIteratorNext(iterator);
            }
            if (this.throws.length) {
                for (const e of this.throws){
                    throw e;
                }
                this.throws.length = 0;
            }
            this.yields.length = 0;
            this.signal = deferred();
        }
    }
    [Symbol.asyncIterator]() {
        return this.iterate();
    }
}
class Server {
    closing = false;
    connections = [];
    constructor(listener){
        this.listener = listener;
    }
    close() {
        this.closing = true;
        this.listener.close();
        for (const conn of this.connections){
            try {
                conn.close();
            } catch (e) {
                if (!(e instanceof Deno.errors.BadResource)) {
                    throw e;
                }
            }
        }
    }
    async *iterateHttpRequests(conn) {
        const reader = new BufReader(conn);
        const writer3 = new BufWriter(conn);
        while(!this.closing){
            let request;
            try {
                request = await readRequest(conn, reader);
            } catch (error) {
                if (error instanceof Deno.errors.InvalidData || error instanceof Deno.errors.UnexpectedEof) {
                    try {
                        await writeResponse(writer3, {
                            status: 400,
                            body: encode(`${error.message}\r\n\r\n`)
                        });
                    } catch (error) {
                    }
                }
                break;
            }
            if (request === null) {
                break;
            }
            request.w = writer3;
            yield request;
            const responseError = await request.done;
            if (responseError) {
                this.untrackConnection(request.conn);
                return;
            }
            try {
                await request.finalize();
            } catch (error) {
                break;
            }
        }
        this.untrackConnection(conn);
        try {
            conn.close();
        } catch (e) {
        }
    }
    trackConnection(conn) {
        this.connections.push(conn);
    }
    untrackConnection(conn) {
        const index = this.connections.indexOf(conn);
        if (index !== -1) {
            this.connections.splice(index, 1);
        }
    }
    async *acceptConnAndIterateHttpRequests(mux) {
        if (this.closing) return;
        let conn;
        try {
            conn = await this.listener.accept();
        } catch (error) {
            if (error instanceof Deno.errors.BadResource || error instanceof Deno.errors.InvalidData || error instanceof Deno.errors.UnexpectedEof || error instanceof Deno.errors.ConnectionReset) {
                return mux.add(this.acceptConnAndIterateHttpRequests(mux));
            }
            throw error;
        }
        this.trackConnection(conn);
        mux.add(this.acceptConnAndIterateHttpRequests(mux));
        yield* this.iterateHttpRequests(conn);
    }
    [Symbol.asyncIterator]() {
        const mux = new MuxAsyncIterator();
        mux.add(this.acceptConnAndIterateHttpRequests(mux));
        return mux.iterate();
    }
}
function _parseAddrFromStr(addr) {
    let url;
    try {
        const host = addr.startsWith(":") ? `0.0.0.0${addr}` : addr;
        url = new URL(`http://${host}`);
    } catch  {
        throw new TypeError("Invalid address.");
    }
    if (url.username || url.password || url.pathname != "/" || url.search || url.hash) {
        throw new TypeError("Invalid address.");
    }
    return {
        hostname: url.hostname,
        port: url.port === "" ? 80 : Number(url.port)
    };
}
function serve(addr) {
    if (typeof addr === "string") {
        addr = _parseAddrFromStr(addr);
    }
    const listener1 = Deno.listen(addr);
    return new Server(listener1);
}
function serveTLS(options1) {
    const tlsOptions = {
        ...options1,
        transport: "tcp"
    };
    const listener1 = Deno.listenTls(tlsOptions);
    return new Server(listener1);
}
function Memoize(options1 = {
}) {
    return function(target, propertyKey, descriptor) {
        const originalFn = descriptor.value;
        const cache = new LruCache();
        let timeout = Number.POSITIVE_INFINITY;
        descriptor.value = async function(...args) {
            const key = options1.resolver ? options1.resolver.apply(this, args) : JSON.stringify(args);
            if (cache.has(key) && (!options1.ttl || timeout > Date.now())) {
                const value = cache.get(key);
                options1.onFound?.apply(this, [
                    key,
                    value
                ]);
                return value;
            } else {
                const result = await originalFn.apply(this, args);
                cache.put(key, result);
                options1.onAdded?.apply(this, [
                    key,
                    result
                ]);
                if (options1.ttl) timeout = Date.now() + options1.ttl;
                return result;
            }
        };
        return descriptor;
    };
}
function Try(options1) {
    return function(target, propertyKey, descriptor) {
        const originalFn = descriptor.value;
        descriptor.value = async function(...args) {
            try {
                return await originalFn.apply(this, args);
            } catch (e) {
                if (options1?.catch) {
                    if (e instanceof Error && !options1.catch.includes(e.constructor.name) || typeof e === "string" && !options1.catch.includes(e)) {
                        throw e;
                    }
                }
                if (options1?.log) {
                    console.error(brightRed("Runtime exception:"), brightYellow(typeof e === "string" ? e : e.message));
                }
                if (options1?.onError) options1.onError(e);
            } finally{
                if (options1?.onDone) options1.onDone();
            }
        };
        return descriptor;
    };
}
class RateLimitError extends Error {
}
function RateLimit(options1) {
    return function(target, propertyKey, descriptor) {
        const originalFn = descriptor.value;
        const queue = new __default1();
        descriptor.value = async function(...args) {
            const now = Date.now();
            while(queue.peekFront() && Date.now() - queue.peekFront() > (options1?.interval ?? 1000)){
                queue.shift();
            }
            if (queue.size() >= (options1?.rate ?? 1)) {
                throw new RateLimitError("Rate limit exceeded");
            }
            let result = undefined;
            queue.push(Date.now());
            return await originalFn.apply(this, args);
        };
        return descriptor;
    };
}
let EgoNet = ((_class = class EgoNet {
    async graph(options) {
        const ego = new EgoGraph({
            query: options.query,
            depth: options.depth,
            radius: options.radius
        });
        await ego.build();
        return JSON.stringify(ego.toObject());
    }
    respond(req, r) {
        return req.respond(r);
    }
    async handleQuery(req, options, headers) {
        console.log(`${brightGreen(req.method)} ${bold(req.url)}`);
        const graph = await this.graph(options);
        headers.set("Cache-Control", `public, max-age=${CACHE_EXPIRATION_MS / 1000}`);
        headers.set("Date", new Date().toUTCString());
        headers.set("Content-Type", "application/json");
        return this.respond(req, {
            status: Status.OK,
            headers,
            body: graph
        });
    }
    handleNotAcceptable(req, headers) {
        console.error(`${req.method} ${req.url} ${brightYellow("Not acceptable")}`);
        return this.respond(req, {
            status: Status.NotAcceptable,
            headers,
            body: JSON.stringify({
                message: "Not Acceptable"
            })
        });
    }
    handleNotFound(req, headers) {
        console.warn(`${req.method} ${req.url} ${brightYellow("Not Found")}`);
        return this.respond(req, {
            status: Status.NotFound,
            headers,
            body: JSON.stringify({
                message: "Request Not Found"
            })
        });
    }
    handleError(req, message, headers) {
        console.error(`${req.method} ${req.url} ${brightRed(message)}`);
        return this.respond(req, {
            status: Status.InternalServerError,
            headers,
            body: JSON.stringify({
                message: "Internal server error",
                error: stripColor(message)
            })
        });
    }
    async startServer() {
        const server = serve({
            hostname: SERVER_HOST,
            port: Number(SERVER_PORT)
        });
        console.info(`${brightBlue("Server")} is running at ${bold(underline(SERVER_HOST + ":" + SERVER_PORT))}`);
        console.info(`Deno: ${brightGreen(Deno.version.deno)} · V8: ${brightGreen(Deno.version.v8)} · TypeScript: ${brightGreen(Deno.version.typescript)}`);
        for await (const req of server){
            const origin = req.headers.get("origin");
            const headers = new Headers();
            if (origin && ALLOWED_ORIGINS.includes(origin)) {
                headers.set("Access-Control-Allow-Origin", origin);
            }
            const host = req.headers.get("host");
            const params = new URLSearchParams(req.url.slice(1));
            if (host && ![
                `localhost:${SERVER_PORT}`,
                `host.docker.internal:${SERVER_PORT}`
            ].includes(host) && !headers.get("Access-Control-Allow-Origin")) {
                this.handleNotAcceptable(req, headers);
            } else if (req.method === "GET" && params.get("q")) {
                this.handleQuery(req, {
                    query: params.get("q") ?? "",
                    ...params.get("d") && {
                        depth: Number(params.get("d"))
                    },
                    ...params.get("r") && {
                        radius: Number(params.get("r"))
                    }
                }, headers).catch(async (e)=>{
                    await this.handleError(req, e.message ?? e, headers);
                });
            } else {
                this.handleNotFound(req, headers);
            }
        }
    }
}) || _class, _dec = Memoize({
    ttl: CACHE_EXPIRATION_MS,
    resolver: (options2)=>{
        return `${options2.query}#${options2.depth ?? EgoGraph.DEFAULT_GRAPH_DEPTH}#${options2.pattern ?? EgoGraph.DEFAULT_SEARCH_PATTERN}#${options2.radius ?? EgoGraph.DEFAULT_GRAPH_RADIUS}`;
    },
    onAdded: (key)=>{
        console.log(`query="${bold(key.split("#")[0])}" added to cache`);
    },
    onFound: (key)=>{
        console.log(`query="${bold(key.split("#")[0])}" served from cache`);
    }
}), _applyDecoratedDescriptor(_class.prototype, "graph", [
    _dec
], Object.getOwnPropertyDescriptor(_class.prototype, "graph"), _class.prototype), _dec1 = Try({
    catch: [
        "BrokenPipe"
    ],
    log: true
}), _applyDecoratedDescriptor(_class.prototype, "respond", [
    _dec1
], Object.getOwnPropertyDescriptor(_class.prototype, "respond"), _class.prototype), _dec2 = RateLimit({
    rate: 50
}), _applyDecoratedDescriptor(_class.prototype, "handleQuery", [
    _dec2
], Object.getOwnPropertyDescriptor(_class.prototype, "handleQuery"), _class.prototype), _dec3 = Try({
    log: true
}), _applyDecoratedDescriptor(_class.prototype, "startServer", [
    _dec3
], Object.getOwnPropertyDescriptor(_class.prototype, "startServer"), _class.prototype), _class);
new EgoNet().startServer();
