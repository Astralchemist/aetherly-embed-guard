/**
 * Build the inline <script> tag that gets injected into the upstream HTML
 * response. Once it runs inside the proxied iframe document it:
 *
 *   1. Replaces `window.open` with a no-op fake-window — so popunder/tab
 *      hijack scripts think they succeeded but no real window is created.
 *   2. Intercepts anchor clicks targeting `_blank` / `_top` / `_parent` (or
 *      any cross-origin href) and silently cancels them.
 *   3. Stubs `HTMLFormElement.prototype.submit` and `HTMLAnchorElement
 *      .prototype.click` so programmatic versions of the same tricks also
 *      fail.
 *   4. Wraps `location.assign` / `location.replace` so they no-op on external
 *      URLs.
 *   5. Wraps `fetch` and `XMLHttpRequest.open` so same-origin (upstream)
 *      requests transparently re-route back through this proxy — that's what
 *      keeps the player's own API calls working after the base URL has been
 *      switched.
 */
export function buildGuardScript(upstreamOrigin: string, proxyPath = '/api/player-proxy?url='): string {
  const safeOrigin = JSON.stringify(upstreamOrigin);
  const safeProxyPath = JSON.stringify(proxyPath);
  return `<script>(function(){if(window.__aetherlyGuard)return;window.__aetherlyGuard=true;
var upstream=${safeOrigin};var proxyPath=${safeProxyPath};
function isExternal(href){try{var u=new URL(href,location.href);return u.origin!==upstream&&u.origin!==location.origin;}catch(e){return true;}}
function routeThroughProxy(href){try{var r;if(href.charAt(0)==='/'&&href.charAt(1)!=='/'){r=new URL(href,upstream);}else{r=new URL(href,location.href);}if(r.origin===upstream){return proxyPath+encodeURIComponent(r.href);}}catch(e){}return null;}
var fakeWin={closed:false,close:function(){this.closed=true;},focus:function(){},blur:function(){},postMessage:function(){},moveTo:function(){},resizeTo:function(){},location:{href:'',origin:'',protocol:'https:',host:'',hostname:'',pathname:'/',search:'',hash:'',assign:function(){},replace:function(){},reload:function(){}},document:{write:function(){},writeln:function(){},open:function(){},close:function(){}},navigator:navigator,history:{back:function(){},forward:function(){},go:function(){}}};
window.open=function(){return fakeWin;};
var origFormSubmit=HTMLFormElement.prototype.submit;HTMLFormElement.prototype.submit=function(){var t=(this.getAttribute('target')||'').toLowerCase();if(t==='_blank'||t==='_top'||t==='_parent')return;return origFormSubmit.apply(this,arguments);};
document.addEventListener('click',function(e){var el=e.target;while(el&&el!==document){if(el.tagName==='A'&&el.href){var t=(el.getAttribute('target')||'').toLowerCase();if(t==='_blank'||t==='_top'||t==='_parent'||isExternal(el.href)){e.preventDefault();e.stopPropagation();return;}}el=el.parentNode;}},true);
var origAnchorClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){var t=(this.getAttribute('target')||'').toLowerCase();if(t==='_blank'||t==='_top'||t==='_parent')return;if(this.href&&isExternal(this.href))return;return origAnchorClick.apply(this,arguments);};
try{var origAssign=location.assign&&location.assign.bind(location);var origReplace=location.replace&&location.replace.bind(location);if(origAssign)location.assign=function(u){if(!isExternal(u))origAssign(u);};if(origReplace)location.replace=function(u){if(!isExternal(u))origReplace(u);};}catch(e){}
if(typeof window.fetch==='function'){var origFetch=window.fetch.bind(window);window.fetch=function(input,init){var url=typeof input==='string'?input:(input&&input.url);if(typeof url==='string'){var routed=routeThroughProxy(url);if(routed){if(typeof input==='string')return origFetch(routed,init);return origFetch(new Request(routed,input),init);}}return origFetch(input,init);};}
var origXHROpen=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url){if(typeof url==='string'){var routed=routeThroughProxy(url);if(routed)arguments[1]=routed;}return origXHROpen.apply(this,arguments);};
})();<\/script>`;
}

const CHALLENGE_MARKERS = [
  'performing security verification',
  'verifies you are not a bot',
  'checking your browser before accessing',
  'cf-browser-verification',
  'cf-chl-bypass',
];

/**
 * Heuristic: does this HTML body look like a Cloudflare / DDoS-Guard / similar
 * bot-challenge page rather than the real upstream content? Used to fast-fail
 * a probe and let the client move on to the next source instead of rendering
 * a useless challenge inside the iframe.
 */
export function looksLikeBotChallenge(html: string): boolean {
  const lower = html.toLowerCase();
  return CHALLENGE_MARKERS.some((marker) => lower.includes(marker));
}
