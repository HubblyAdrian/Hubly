#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const f=[];
const c=(n,ok)=>{if(!ok){console.error("FAIL "+n);f.push(n)}else console.log("OK "+n)};
const hubly=fs.readFileSync(path.join(root,"public/hubly.html"),"utf8");
const router=fs.readFileSync(path.join(root,"api/router.js"),"utf8");
const home=fs.readFileSync(path.join(root,"public/platform-home.html"),"utf8");
const jjs=fs.readFileSync(path.join(root,"public/journey-os/journey.js"),"utf8");
const px=fs.existsSync(path.join(root,"public/journey-os/operate-pixel.css"))
  ?fs.readFileSync(path.join(root,"public/journey-os/operate-pixel.css"),"utf8")
  :"";
c("files",fs.existsSync(path.join(root,"public/journey-os/journey.css")));
c("operate-pixel.css",!!px&&/#p-app\.jos-pixel/.test(px));
c("router",/journey-os\//.test(router));
c("nav layers",/data-nav-sec="Operations"/.test(hubly)&&/data-nav-sec="Customer Intelligence"/.test(hubly)&&/data-nav-sec="Growth"/.test(hubly)&&/data-nav-sec="Setup"/.test(hubly));
c("nav items",/Pipeline[\s\S]*Opportunities[\s\S]*Ask Hubly/.test(hubly)&&/data-v="activity"/.test(hubly));
c("no Main/Profile wipe",/document\.querySelectorAll\('\.nav-sec'\)\.forEach\(\(el\)=>\{[\s\S]*data-nav-sec/.test(hubly)&&!/\.nav-sec'\)\.forEach\(\(el,i\)=>\{[\s\S]*navMain/.test(hubly));
c("pixel shell",/jos-pixel/.test(hubly)&&/operate-pixel\.css/.test(hubly)&&/enhanceDashboard/.test(jjs)&&/renderCustomersPage/.test(jjs));
c("revenue hidden",/data-v="money"[\s\S]*hidden/.test(hubly)||/ni\[data-v="money"\][\s\S]*display:none/.test(px));
c("views",/id="v-pipeline"/.test(hubly)&&/id="v-ask"/.test(hubly)&&/id="v-growth"/.test(hubly)&&/id="jos-dash-root"/.test(hubly));
c("api",/renderPipeline/.test(jjs)&&/openCustomerProfile/.test(jjs));
c("landing",/Build your business/.test(hubly)&&/Build your business/.test(home));
c("script",/journey-os\/journey\.js/.test(hubly));
c("ceo demo route",/\/demo.:.p-ceo-demo/.test(hubly)&&/startCeoDemoMode/.test(hubly)&&fs.existsSync(path.join(root,"public/journey-os/ceo-demo.js")));
c("create live build",/I'm building this live so you can watch it take shape/.test(hubly)&&/is-creative-grid/.test(hubly)&&/isRunCreativeBuildExperience/.test(hubly));
c("create demo route",/\/create-demo/.test(hubly)&&/startCreateDemoMode/.test(hubly)&&/isCreateDemoPath/.test(hubly));
if(f.length) process.exit(1); console.log("PASS");
