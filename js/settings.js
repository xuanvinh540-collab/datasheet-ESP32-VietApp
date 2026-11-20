/* Cài đặt trang, sửa bằng admin (tab Cài đặt & Sửa trực tiếp). */
window.SITE = {
  "showBuyCards": false,
  "texts": {
    "#modeBar button[data-m=\"studio\"]": "Module PCB"
  }
};
(function(){var T=window.SITE&&window.SITE.texts;if(!T)return;function go(){for(var k in T){var e=document.querySelector(k);if(!e)continue;var ns=[].slice.call(e.childNodes).filter(function(n){return n.nodeType===3&&n.nodeValue.trim()});if(ns.length)ns[ns.length-1].nodeValue=T[k];else if(!e.children.length)e.textContent=T[k]}}if(document.readyState==="loading")addEventListener("DOMContentLoaded",go);else go();setTimeout(go,600);setTimeout(go,1800)})();
