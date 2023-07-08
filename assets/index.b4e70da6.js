var P=Object.defineProperty;var R=(t,n,s)=>n in t?P(t,n,{enumerable:!0,configurable:!0,writable:!0,value:s}):t[n]=s;var f=(t,n,s)=>(R(t,typeof n!="symbol"?n+"":n,s),s);(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const c of document.querySelectorAll('link[rel="modulepreload"]'))a(c);new MutationObserver(c=>{for(const o of c)if(o.type==="childList")for(const l of o.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&a(l)}).observe(document,{childList:!0,subtree:!0});function s(c){const o={};return c.integrity&&(o.integrity=c.integrity),c.referrerpolicy&&(o.referrerPolicy=c.referrerpolicy),c.crossorigin==="use-credentials"?o.credentials="include":c.crossorigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function a(c){if(c.ep)return;c.ep=!0;const o=s(c);fetch(c.href,o)}})();class r{static getSafeHtmlElement(n){const s=document.getElementById(n);if(s==null)throw new Error(`Element: ${n} not found.`);return s}}const y=class{};let i=y;f(i,"c",r.getSafeHtmlElement("myCanvas")),f(i,"ctx",y.c.getContext("2d"));r.getSafeHtmlElement("downloadBtn").addEventListener("click",function(){const t=document.createElement("a");t.download="canvas.png",t.href=i.c.toDataURL(),t.click()});class e{}f(e,"dotRadius",5),f(e,"dots",[]),f(e,"selectedDot"),f(e,"hoverDot"),f(e,"lines",[]),f(e,"selectedLine"),f(e,"hoverLine"),f(e,"changes",[]),f(e,"changeIndex",-1),f(e,"canvasBackgroundColor","#046307");const C=r.getSafeHtmlElement("saveProgressBtn");C.addEventListener("click",function(){localStorage.setItem("canvasDots",JSON.stringify(e.dots)),localStorage.setItem("canvasLines",JSON.stringify(e.lines)),alert("Project saved to local storage.")});const O=r.getSafeHtmlElement("saveProjectBtn");O.addEventListener("click",function(){const t="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify({dots:e.dots,lines:e.lines})),n=document.createElement("a");n.setAttribute("href",t),n.setAttribute("download","canvas_project.json"),document.body.appendChild(n),n.click(),n.remove()});function L(){i.ctx.fillStyle=e.canvasBackgroundColor,i.ctx.clearRect(0,0,i.c.width,i.c.height),i.ctx.fillRect(0,0,i.c.width,i.c.height),i.ctx.fill()}function T(t){i.ctx.beginPath(),i.ctx.arc(t.x,t.y,e.dotRadius,0,Math.PI*2),i.ctx.fillStyle=t.color,i.ctx.fill(),t==e.selectedDot&&(i.ctx.strokeStyle="#00f",i.ctx.lineWidth=3,i.ctx.stroke()),t.description&&(i.ctx.font="10px Arial",i.ctx.textAlign="center",i.ctx.fillStyle=t.color,i.ctx.fillText(t.description.substring(0,5),t.x,t.y+e.dotRadius+10))}function N(t){i.ctx.beginPath(),i.ctx.moveTo(t.start.x,t.start.y),i.ctx.lineTo(t.end.x,t.end.y),i.ctx.strokeStyle=t.color,i.ctx.lineWidth=t==e.selectedLine?5:t==e.hoverLine?4:3,i.ctx.stroke()}function d(){L();for(let t=0;t<e.dots.length;t++)T(e.dots[t]);for(let t=0;t<e.lines.length;t++)N(e.lines[t])}i.c.addEventListener("mousedown",function(t){j(i.c,t)});function j(t,n){const s=t.getBoundingClientRect(),a=n.clientX-s.left,c=n.clientY-s.top;for(let o=0;o<e.dots.length;o++){const l=e.dots[o],h=a-l.x,u=c-l.y;if(h*h+u*u<e.dotRadius*e.dotRadius){if(e.selectedDot&&e.selectedDot!=l){const g={start:e.selectedDot,end:l,color:"#777676"};e.lines.push(g),e.changes.splice(e.changeIndex+1),e.changes.push({type:"add",line:g}),e.changeIndex++,e.selectedDot=void 0,e.selectedLine=g,d()}else e.selectedDot=l,e.selectedLine=void 0,d();return}}for(let o=0;o<e.lines.length;o++){const l=e.lines[o],h=l.start.x-a,u=l.start.y-c,g=l.end.x-a,p=l.end.y-c,v=Math.sqrt(h*h+u*u),x=Math.sqrt(g*g+p*p),M=Math.sqrt(Math.pow(l.end.x-l.start.x,2)+Math.pow(l.end.y-l.start.y,2));if(Math.abs(M-(v+x))<5){e.selectedLine=l,e.selectedDot=void 0,d();return}}e.selectedDot=void 0,e.selectedLine=void 0,d()}const k=r.getSafeHtmlElement("loadProjectBtn"),A=r.getSafeHtmlElement("loadProjectTrigger");A.addEventListener("click",function(){k.click()});k.addEventListener("change",function(t){const n=t.target.files[0];if(!n)return;const s=new FileReader;s.onload=function(a){const c=a.target.result,o=JSON.parse(c);e.dots=o.dots,e.lines=o.lines,d()},s.readAsText(n)});i.c.addEventListener("mousemove",function(t){const n=i.c.getBoundingClientRect(),s=t.clientX-n.left,a=t.clientY-n.top;e.hoverDot=void 0;for(let c=0;c<e.dots.length;c++){const o=e.dots[c],l=s-o.x,h=a-o.y;if(l*l+h*h<e.dotRadius*e.dotRadius){e.hoverDot=o;break}}e.hoverLine=void 0;for(let c=0;c<e.lines.length;c++){const o=e.lines[c],l=o.start.x-s,h=o.start.y-a,u=o.end.x-s,g=o.end.y-a,p=Math.sqrt(l*l+h*h),v=Math.sqrt(u*u+g*g),x=Math.sqrt(Math.pow(o.end.x-o.start.x,2)+Math.pow(o.end.y-o.start.y,2));if(Math.abs(x-(p+v))<10){e.hoverLine=o;break}}d(),e.hoverDot&&e.hoverDot.description?r.getSafeHtmlElement("dotDescription").innerText=e.hoverDot.description:r.getSafeHtmlElement("dotDescription").innerText=""});window.addEventListener("keypress",t=>{console.log(t);for(const n of m.sohortcuts)t.key==n.key&&n.event(t)});class m{static add(n){this.sohortcuts.find(s=>n.key==s.key)!==void 0&&console.warn(`Shortcut key: ${n.key} already exists`),this.sohortcuts.push(n),this.show()}static show(){r.getSafeHtmlElement("shortcuts").innerHTML="<b>Shortcuts:</b> <br>"+this.sohortcuts.map(n=>`key: <b>${n.key}</b> - ${n.description}`).join("<br>")}}f(m,"sohortcuts",[]);r.getSafeHtmlElement("addDescriptionBtn").addEventListener("click",function(){E()});r.getSafeHtmlElement("deleteDescriptionBtn").addEventListener("click",function(){D()});function E(){if(e.selectedDot){const t=prompt("Enter a description for the dot");e.selectedDot.description=t,e.selectedDot=void 0,d()}else alert("Please select a dot first by clicking on it")}function D(){e.selectedDot?(e.selectedDot.description=null,d()):alert("Please select a dot first by clicking on it")}m.add({key:"d",event:E,description:"Add description."});m.add({key:"D",event:D,description:"Remove description."});r.getSafeHtmlElement("changeDotColorBtn").addEventListener("click",function(){S()});function S(){!e.selectedDot||(r.getSafeHtmlElement("colorPicker").onchange=function(){e.selectedDot&&(e.selectedDot.color=this.value,d())},r.getSafeHtmlElement("colorPicker").click())}r.getSafeHtmlElement("changeLineColorBtn").addEventListener("click",function(){w()});r.getSafeHtmlElement("deleteLineBtn").addEventListener("click",function(){I()});function w(){!e.selectedLine||(r.getSafeHtmlElement("colorPicker").onchange=function(){e.selectedLine&&(e.selectedLine.color=this.value,d())},r.getSafeHtmlElement("colorPicker").click())}function I(){if(e.selectedLine){const t=e.lines.indexOf(e.selectedLine);t>-1&&(e.changes.splice(e.changeIndex+1),e.changes.push({type:"remove",line:e.selectedLine}),e.changeIndex++,e.lines.splice(t,1),e.selectedLine=void 0,d())}else alert("Please select a line first by clicking on it")}m.add({key:"Delete",event:I,description:"Delete line."});m.add({key:"c",event:()=>{w(),S()},description:"Change dot/line color."});r.getSafeHtmlElement("backBtn").addEventListener("click",function(){if(e.changeIndex>=0){const t=e.changes[e.changeIndex];if(t.type=="add"){for(let n=0;n<e.lines.length;n++)if(e.lines[n].start==t.line.start&&e.lines[n].end==t.line.end){e.lines.splice(n,1);break}}else t.type=="remove"&&e.lines.push(t.line);e.changeIndex--,d()}});r.getSafeHtmlElement("forwardBtn").addEventListener("click",function(){if(e.changeIndex<e.changes.length-1){e.changeIndex++;const t=e.changes[e.changeIndex];if(t==null)return;if(t.type=="add")e.lines.push(t.line);else if(t.type=="remove"){for(let n=0;n<e.lines.length;n++)if(e.lines[n].start==t.line.start&&e.lines[n].end==t.line.end){e.lines.splice(n,1);break}}d()}});window.addEventListener("DOMContentLoaded",()=>{if(localStorage.getItem("canvasDots")!==null&&localStorage.getItem("canvasLines")!==null){const t=localStorage.getItem("canvasDots"),n=localStorage.getItem("canvasLines");t&&n&&(e.dots=JSON.parse(t),e.lines=JSON.parse(n)),d()}});const H=r.getSafeHtmlElement("dotMatrixWidth"),b=r.getSafeHtmlElement("dotMatrixHeight"),q=r.getSafeHtmlElement("resizeGridBtn");q.addEventListener("click",function(){const t=parseInt(H.value),n=parseInt(b.value);B(t,n),e.lines=[],d()});function B(t,n){const s=i.c.width/t,a=i.c.height/n;e.dots=[];for(let c=s/2;c<i.c.width;c+=s)for(let o=a/2;o<i.c.height;o+=a)e.dots.push({x:c,y:o,description:null,color:"#a4a0a0"})}B(parseInt(H.value||"10"),parseInt(b.value||"10"));L();d();
