var P=Object.defineProperty;var R=(t,n,s)=>n in t?P(t,n,{enumerable:!0,configurable:!0,writable:!0,value:s}):t[n]=s;var f=(t,n,s)=>(R(t,typeof n!="symbol"?n+"":n,s),s);(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const c of document.querySelectorAll('link[rel="modulepreload"]'))a(c);new MutationObserver(c=>{for(const i of c)if(i.type==="childList")for(const l of i.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&a(l)}).observe(document,{childList:!0,subtree:!0});function s(c){const i={};return c.integrity&&(i.integrity=c.integrity),c.referrerpolicy&&(i.referrerPolicy=c.referrerpolicy),c.crossorigin==="use-credentials"?i.credentials="include":c.crossorigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function a(c){if(c.ep)return;c.ep=!0;const i=s(c);fetch(c.href,i)}})();class d{static getSafeHtmlElement(n){const s=document.getElementById(n);if(s==null)throw new Error(`Element: ${n} not found.`);return s}}const D=class{};let o=D;f(o,"c",d.getSafeHtmlElement("myCanvas")),f(o,"ctx",D.c.getContext("2d"));d.getSafeHtmlElement("downloadBtn").addEventListener("click",function(){const t=document.createElement("a");t.download="canvas.png",t.href=o.c.toDataURL(),t.click()});class e{}f(e,"dotRadius",5),f(e,"dots",[]),f(e,"selectedDot"),f(e,"hoverDot"),f(e,"lines",[]),f(e,"selectedLine"),f(e,"hoverLine"),f(e,"changes",[]),f(e,"changeIndex",-1),f(e,"canvasBackgroundColor","#046307");const C=d.getSafeHtmlElement("saveProgressBtn");C.addEventListener("click",function(){localStorage.setItem("canvasDots",JSON.stringify(e.dots)),localStorage.setItem("canvasLines",JSON.stringify(e.lines)),alert("Project saved to local storage.")});const O=d.getSafeHtmlElement("saveProjectBtn");O.addEventListener("click",function(){const t="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify({dots:e.dots,lines:e.lines,canvas:{width:o.c.width,height:o.c.height}})),n=document.createElement("a");n.setAttribute("href",t),n.setAttribute("download","canvas_project.json"),document.body.appendChild(n),n.click(),n.remove()});function y(){o.ctx.fillStyle=e.canvasBackgroundColor,o.ctx.clearRect(0,0,o.c.width,o.c.height),o.ctx.fillRect(0,0,o.c.width,o.c.height),o.ctx.fill()}function T(t){o.ctx.beginPath(),o.ctx.arc(t.x,t.y,e.dotRadius,0,Math.PI*2),o.ctx.fillStyle=t.color,o.ctx.fill(),t==e.selectedDot&&(o.ctx.strokeStyle="#00f",o.ctx.lineWidth=3,o.ctx.stroke()),t.description&&(o.ctx.font="10px Arial",o.ctx.textAlign="center",o.ctx.fillStyle=t.color,o.ctx.fillText(t.description.substring(0,5),t.x,t.y+e.dotRadius+10))}function N(t){o.ctx.beginPath(),o.ctx.moveTo(t.start.x,t.start.y),o.ctx.lineTo(t.end.x,t.end.y),o.ctx.strokeStyle=t.color,o.ctx.lineWidth=t==e.selectedLine?5:t==e.hoverLine?4:3,o.ctx.stroke()}function r(){y();for(let t=0;t<e.dots.length;t++)T(e.dots[t]);for(let t=0;t<e.lines.length;t++)N(e.lines[t])}o.c.addEventListener("mousedown",function(t){j(o.c,t)});function j(t,n){const s=t.getBoundingClientRect(),a=n.clientX-s.left,c=n.clientY-s.top;for(let i=0;i<e.dots.length;i++){const l=e.dots[i],h=a-l.x,u=c-l.y;if(h*h+u*u<e.dotRadius*e.dotRadius){if(e.selectedDot&&e.selectedDot!=l){const g={start:e.selectedDot,end:l,color:"#777676"};e.lines.push(g),e.changes.splice(e.changeIndex+1),e.changes.push({type:"add",line:g}),e.changeIndex++,e.selectedDot=void 0,e.selectedLine=g,r()}else e.selectedDot=l,e.selectedLine=void 0,r();return}}for(let i=0;i<e.lines.length;i++){const l=e.lines[i],h=l.start.x-a,u=l.start.y-c,g=l.end.x-a,p=l.end.y-c,v=Math.sqrt(h*h+u*u),x=Math.sqrt(g*g+p*p),M=Math.sqrt(Math.pow(l.end.x-l.start.x,2)+Math.pow(l.end.y-l.start.y,2));if(Math.abs(M-(v+x))<5){e.selectedLine=l,e.selectedDot=void 0,r();return}}e.selectedDot=void 0,e.selectedLine=void 0,r()}const S=d.getSafeHtmlElement("loadProjectBtn"),A=d.getSafeHtmlElement("loadProjectTrigger");A.addEventListener("click",function(){S.click()});S.addEventListener("change",function(t){const n=t.target.files[0];if(!n)return;const s=new FileReader;s.onload=function(a){const c=a.target.result,i=JSON.parse(c);o.c.width=i.canvas.width,o.c.height=i.canvas.height,e.dots=i.dots,e.lines=i.lines,r()},s.readAsText(n)});o.c.addEventListener("mousemove",function(t){const n=o.c.getBoundingClientRect(),s=t.clientX-n.left,a=t.clientY-n.top;e.hoverDot=void 0;for(let c=0;c<e.dots.length;c++){const i=e.dots[c],l=s-i.x,h=a-i.y;if(l*l+h*h<e.dotRadius*e.dotRadius){e.hoverDot=i;break}}e.hoverLine=void 0;for(let c=0;c<e.lines.length;c++){const i=e.lines[c],l=i.start.x-s,h=i.start.y-a,u=i.end.x-s,g=i.end.y-a,p=Math.sqrt(l*l+h*h),v=Math.sqrt(u*u+g*g),x=Math.sqrt(Math.pow(i.end.x-i.start.x,2)+Math.pow(i.end.y-i.start.y,2));if(Math.abs(x-(p+v))<10){e.hoverLine=i;break}}r(),e.hoverDot&&e.hoverDot.description?d.getSafeHtmlElement("dotDescription").innerText=e.hoverDot.description:d.getSafeHtmlElement("dotDescription").innerText=""});window.addEventListener("keypress",t=>{console.log(t);for(const n of m.sohortcuts)t.key==n.key&&n.event(t)});class m{static add(n){this.sohortcuts.find(s=>n.key==s.key)!==void 0&&console.warn(`Shortcut key: ${n.key} already exists`),this.sohortcuts.push(n),this.show()}static show(){d.getSafeHtmlElement("shortcuts").innerHTML="<b>Shortcuts:</b> <br>"+this.sohortcuts.map(n=>`key: <b>${n.key}</b> - ${n.description}`).join("<br>")}}f(m,"sohortcuts",[]);d.getSafeHtmlElement("addDescriptionBtn").addEventListener("click",function(){w()});d.getSafeHtmlElement("deleteDescriptionBtn").addEventListener("click",function(){I()});function w(){if(e.selectedDot){const t=prompt("Enter a description for the dot");e.selectedDot.description=t,e.selectedDot=void 0,r()}else alert("Please select a dot first by clicking on it")}function I(){e.selectedDot?(e.selectedDot.description=null,r()):alert("Please select a dot first by clicking on it")}m.add({key:"d",event:w,description:"Add description."});m.add({key:"D",event:I,description:"Remove description."});d.getSafeHtmlElement("changeDotColorBtn").addEventListener("click",function(){H()});function H(){!e.selectedDot||(d.getSafeHtmlElement("colorPicker").onchange=function(){e.selectedDot&&(e.selectedDot.color=this.value,r())},d.getSafeHtmlElement("colorPicker").click())}d.getSafeHtmlElement("changeLineColorBtn").addEventListener("click",function(){b()});d.getSafeHtmlElement("deleteLineBtn").addEventListener("click",function(){B()});function b(){!e.selectedLine||(d.getSafeHtmlElement("colorPicker").onchange=function(){e.selectedLine&&(e.selectedLine.color=this.value,r())},d.getSafeHtmlElement("colorPicker").click())}function B(){if(e.selectedLine){const t=e.lines.indexOf(e.selectedLine);t>-1&&(e.changes.splice(e.changeIndex+1),e.changes.push({type:"remove",line:e.selectedLine}),e.changeIndex++,e.lines.splice(t,1),e.selectedLine=void 0,r())}else alert("Please select a line first by clicking on it")}m.add({key:"Delete",event:B,description:"Delete line."});m.add({key:"c",event:()=>{b(),H()},description:"Change dot/line color."});d.getSafeHtmlElement("backBtn").addEventListener("click",function(){if(e.changeIndex>=0){const t=e.changes[e.changeIndex];if(t.type=="add"){for(let n=0;n<e.lines.length;n++)if(e.lines[n].start==t.line.start&&e.lines[n].end==t.line.end){e.lines.splice(n,1);break}}else t.type=="remove"&&e.lines.push(t.line);e.changeIndex--,r()}});d.getSafeHtmlElement("forwardBtn").addEventListener("click",function(){if(e.changeIndex<e.changes.length-1){e.changeIndex++;const t=e.changes[e.changeIndex];if(t==null)return;if(t.type=="add")e.lines.push(t.line);else if(t.type=="remove"){for(let n=0;n<e.lines.length;n++)if(e.lines[n].start==t.line.start&&e.lines[n].end==t.line.end){e.lines.splice(n,1);break}}r()}});window.addEventListener("DOMContentLoaded",()=>{if(localStorage.getItem("canvasDots")!==null&&localStorage.getItem("canvasLines")!==null){const t=localStorage.getItem("canvasDots"),n=localStorage.getItem("canvasLines");t&&n&&(e.dots=JSON.parse(t),e.lines=JSON.parse(n)),r()}});const L=d.getSafeHtmlElement("dotMatrixWidth"),k=d.getSafeHtmlElement("dotMatrixHeight"),q=d.getSafeHtmlElement("resizeGridBtn");q.addEventListener("click",function(){const t=parseInt(L.value),n=parseInt(k.value);E(t,n),e.lines=[],r()});function E(t,n){o.c.width=t*50,o.c.height=n*50;const s=o.c.width/t,a=o.c.height/n;e.dots=[];for(let c=s/2;c<o.c.width;c+=s)for(let i=a/2;i<o.c.height;i+=a)e.dots.push({x:c,y:i,description:null,color:"#a4a0a0"})}d.getSafeHtmlElement("resetBtn").addEventListener("click",function(){e.lines=[],e.dots=[],E(parseInt(L.value||"10"),parseInt(k.value||"10")),y(),r()});E(parseInt(L.value||"10"),parseInt(k.value||"10"));y();r();
