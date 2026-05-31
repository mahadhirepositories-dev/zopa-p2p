import{a as mt}from"./chunk-2OERFNNI.js";import{a as ct}from"./chunk-7B2SQVMT.js";import{a as dt}from"./chunk-YHD53W4Z.js";import{a as ot,b as lt,c as rt}from"./chunk-OEALTD7F.js";import{b as Re,c as Ae}from"./chunk-RDOD2STN.js";import{a as ze}from"./chunk-DAVBWPNJ.js";import{a as He,b as $e,c as Xe,d as Qe,e as We,f as Ye,g as Je,h as Ke,i as et,j as tt,k as it}from"./chunk-VRKLVMWA.js";import{b as st}from"./chunk-LTSBQFOI.js";import{a as at}from"./chunk-Q3MLQ7YE.js";import{a as nt}from"./chunk-QDY5F6EO.js";import"./chunk-VSBEABGU.js";import"./chunk-I2DWI7XB.js";import{a as je,b as Be}from"./chunk-SGFZ26CI.js";import{a as Le,b as Ue,c as Ne,d as qe,e as Ge,f as Ze}from"./chunk-XNQVLY2L.js";import"./chunk-RSJ2PLQJ.js";import{E as Ie,a as fe,b as be,c as ve,d as x,f as Ce,g as xe,j as we,o as ye,p as ke,t as Se,v as Ee,x as De,y as Me,z as Te}from"./chunk-PABTAVK3.js";import{a as Ve,b as Fe}from"./chunk-DVPZ53CF.js";import{I as se,L as ce,P as me,R as pe,S as _e,U as ge,V as ue,W as Pe,X as Oe,g as le,i as re,x as de}from"./chunk-TDMVGHP2.js";import{a as he}from"./chunk-D5VTAEVL.js";import{d as ae,e as oe}from"./chunk-2XYDRYFQ.js";import"./chunk-PDJ5YBGY.js";import{Ab as B,Bb as H,Cb as g,Db as t,Dc as ee,Eb as i,Fb as m,Fc as te,Ic as ie,Jb as E,Kb as D,Lc as M,Mb as w,Mc as ne,Nb as $,Qb as c,Ra as Z,Sb as s,T as F,Ta as d,Tb as X,Ub as Q,V as L,Wb as W,X as U,Xb as Y,Yb as J,Z as C,ac as T,ca as p,cc as A,da as _,dc as P,ea as N,ec as l,fc as v,gb as I,gc as k,hb as j,ka as R,mb as y,pa as b,rc as K,ta as q,vb as z,wa as G,wb as u,xb as h}from"./chunk-2A65Y3QA.js";import"./chunk-7CGTOI24.js";var ut=["switch"],ht=["*"];function ft(n,r){n&1&&(t(0,"span",11),N(),t(1,"svg",13),m(2,"path",14),i(),t(3,"svg",15),m(4,"path",16),i()())}var bt=new U("mat-slide-toggle-default-options",{providedIn:"root",factory:()=>({disableToggleValue:!1,hideIcon:!1,disabledInteractive:!1})}),O=class{source;checked;constructor(r,e){this.source=r,this.checked=e}},V=(()=>{class n{_elementRef=C(G);_focusMonitor=C(le);_changeDetectorRef=C(ie);defaults=C(bt);_onChange=e=>{};_onTouched=()=>{};_validatorOnChange=()=>{};_uniqueId;_checked=!1;_createChangeEvent(e){return new O(this,e)}_labelId;get buttonId(){return`${this.id||this._uniqueId}-button`}_switchElement;focus(){this._switchElement.nativeElement.focus()}_noopAnimations=ce();_focused=!1;name=null;id;labelPosition="after";ariaLabel=null;ariaLabelledby=null;ariaDescribedby;required=!1;color;disabled=!1;disableRipple=!1;tabIndex=0;get checked(){return this._checked}set checked(e){this._checked=e,this._changeDetectorRef.markForCheck()}hideIcon;disabledInteractive;change=new R;toggleChange=new R;get inputId(){return`${this.id||this._uniqueId}-input`}constructor(){C(re).load(pe);let e=C(new ee("tabindex"),{optional:!0}),o=this.defaults;this.tabIndex=e==null?0:parseInt(e)||0,this.color=o.color||"accent",this.id=this._uniqueId=C(de).getId("mat-mdc-slide-toggle-"),this.hideIcon=o.hideIcon??!1,this.disabledInteractive=o.disabledInteractive??!1,this._labelId=this._uniqueId+"-label"}ngAfterContentInit(){this._focusMonitor.monitor(this._elementRef,!0).subscribe(e=>{e==="keyboard"||e==="program"?(this._focused=!0,this._changeDetectorRef.markForCheck()):e||Promise.resolve().then(()=>{this._focused=!1,this._onTouched(),this._changeDetectorRef.markForCheck()})})}ngOnChanges(e){e.required&&this._validatorOnChange()}ngOnDestroy(){this._focusMonitor.stopMonitoring(this._elementRef)}writeValue(e){this.checked=!!e}registerOnChange(e){this._onChange=e}registerOnTouched(e){this._onTouched=e}validate(e){return this.required&&e.value!==!0?{required:!0}:null}registerOnValidatorChange(e){this._validatorOnChange=e}setDisabledState(e){this.disabled=e,this._changeDetectorRef.markForCheck()}toggle(){this.checked=!this.checked,this._onChange(this.checked)}_emitChangeEvent(){this._onChange(this.checked),this.change.emit(this._createChangeEvent(this.checked))}_handleClick(){this.disabled||(this.toggleChange.emit(),this.defaults.disableToggleValue||(this.checked=!this.checked,this._onChange(this.checked),this.change.emit(new O(this,this.checked))))}_getAriaLabelledBy(){return this.ariaLabelledby?this.ariaLabelledby:this.ariaLabel?null:this._labelId}static \u0275fac=function(o){return new(o||n)};static \u0275cmp=I({type:n,selectors:[["mat-slide-toggle"]],viewQuery:function(o,a){if(o&1&&W(ut,5),o&2){let f;Y(f=J())&&(a._switchElement=f.first)}},hostAttrs:[1,"mat-mdc-slide-toggle"],hostVars:13,hostBindings:function(o,a){o&2&&($("id",a.id),z("tabindex",null)("aria-label",null)("name",null)("aria-labelledby",null),P(a.color?"mat-"+a.color:""),A("mat-mdc-slide-toggle-focused",a._focused)("mat-mdc-slide-toggle-checked",a.checked)("_mat-animation-noopable",a._noopAnimations))},inputs:{name:"name",id:"id",labelPosition:"labelPosition",ariaLabel:[0,"aria-label","ariaLabel"],ariaLabelledby:[0,"aria-labelledby","ariaLabelledby"],ariaDescribedby:[0,"aria-describedby","ariaDescribedby"],required:[2,"required","required",M],color:"color",disabled:[2,"disabled","disabled",M],disableRipple:[2,"disableRipple","disableRipple",M],tabIndex:[2,"tabIndex","tabIndex",e=>e==null?0:ne(e)],checked:[2,"checked","checked",M],hideIcon:[2,"hideIcon","hideIcon",M],disabledInteractive:[2,"disabledInteractive","disabledInteractive",M]},outputs:{change:"change",toggleChange:"toggleChange"},exportAs:["matSlideToggle"],features:[K([{provide:fe,useExisting:F(()=>n),multi:!0},{provide:ve,useExisting:n,multi:!0}]),q],ngContentSelectors:ht,decls:14,vars:27,consts:[["switch",""],["mat-internal-form-field","",3,"labelPosition"],["role","switch","type","button",1,"mdc-switch",3,"click","tabIndex","disabled"],[1,"mat-mdc-slide-toggle-touch-target"],[1,"mdc-switch__track"],[1,"mdc-switch__handle-track"],[1,"mdc-switch__handle"],[1,"mdc-switch__shadow"],[1,"mdc-elevation-overlay"],[1,"mdc-switch__ripple"],["mat-ripple","",1,"mat-mdc-slide-toggle-ripple","mat-focus-indicator",3,"matRippleTrigger","matRippleDisabled","matRippleCentered"],[1,"mdc-switch__icons"],[1,"mdc-label",3,"click","for"],["viewBox","0 0 24 24","aria-hidden","true",1,"mdc-switch__icon","mdc-switch__icon--on"],["d","M19.69,5.23L8.96,15.96l-4.23-4.23L2.96,13.5l6,6L21.46,7L19.69,5.23z"],["viewBox","0 0 24 24","aria-hidden","true",1,"mdc-switch__icon","mdc-switch__icon--off"],["d","M20 13H4v-2h16v2z"]],template:function(o,a){if(o&1&&(X(),t(0,"div",1)(1,"button",2,0),c("click",function(){return a._handleClick()}),m(3,"div",3)(4,"span",4),t(5,"span",5)(6,"span",6)(7,"span",7),m(8,"span",8),i(),t(9,"span",9),m(10,"span",10),i(),u(11,ft,5,0,"span",11),i()()(),t(12,"label",12),c("click",function(S){return S.stopPropagation()}),Q(13),i()()),o&2){let f=T(2);g("labelPosition",a.labelPosition),d(),A("mdc-switch--selected",a.checked)("mdc-switch--unselected",!a.checked)("mdc-switch--checked",a.checked)("mdc-switch--disabled",a.disabled)("mat-mdc-slide-toggle-disabled-interactive",a.disabledInteractive),g("tabIndex",a.disabled&&!a.disabledInteractive?-1:a.tabIndex)("disabled",a.disabled&&!a.disabledInteractive),z("id",a.buttonId)("name",a.name)("aria-label",a.ariaLabel)("aria-labelledby",a._getAriaLabelledBy())("aria-describedby",a.ariaDescribedby)("aria-required",a.required||null)("aria-checked",a.checked)("aria-disabled",a.disabled&&a.disabledInteractive?"true":null),d(9),g("matRippleTrigger",f)("matRippleDisabled",a.disableRipple||a.disabled)("matRippleCentered",!0),d(),h(a.hideIcon?-1:11),d(),g("for",a.buttonId),z("id",a._labelId)}},dependencies:[me,dt],styles:[`.mdc-switch {
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  display: inline-flex;
  flex-shrink: 0;
  margin: 0;
  outline: none;
  overflow: visible;
  padding: 0;
  position: relative;
  width: var(--mat-slide-toggle-track-width, 52px);
}
.mdc-switch.mdc-switch--disabled {
  cursor: default;
  pointer-events: none;
}
.mdc-switch.mat-mdc-slide-toggle-disabled-interactive {
  pointer-events: auto;
}

.mdc-switch__track {
  overflow: hidden;
  position: relative;
  width: 100%;
  height: var(--mat-slide-toggle-track-height, 32px);
  border-radius: var(--mat-slide-toggle-track-shape, var(--mat-sys-corner-full));
}
.mdc-switch--disabled.mdc-switch .mdc-switch__track {
  opacity: var(--mat-slide-toggle-disabled-track-opacity, 0.12);
}
.mdc-switch__track::before, .mdc-switch__track::after {
  border: 1px solid transparent;
  border-radius: inherit;
  box-sizing: border-box;
  content: "";
  height: 100%;
  left: 0;
  position: absolute;
  width: 100%;
  border-width: var(--mat-slide-toggle-track-outline-width, 2px);
  border-color: var(--mat-slide-toggle-track-outline-color, var(--mat-sys-outline));
}
.mdc-switch--selected .mdc-switch__track::before, .mdc-switch--selected .mdc-switch__track::after {
  border-width: var(--mat-slide-toggle-selected-track-outline-width, 2px);
  border-color: var(--mat-slide-toggle-selected-track-outline-color, transparent);
}
.mdc-switch--disabled .mdc-switch__track::before, .mdc-switch--disabled .mdc-switch__track::after {
  border-width: var(--mat-slide-toggle-disabled-unselected-track-outline-width, 2px);
  border-color: var(--mat-slide-toggle-disabled-unselected-track-outline-color, var(--mat-sys-on-surface));
}
@media (forced-colors: active) {
  .mdc-switch__track {
    border-color: currentColor;
  }
}
.mdc-switch__track::before {
  transition: transform 75ms 0ms cubic-bezier(0, 0, 0.2, 1);
  transform: translateX(0);
  background: var(--mat-slide-toggle-unselected-track-color, var(--mat-sys-surface-variant));
}
.mdc-switch--selected .mdc-switch__track::before {
  transition: transform 75ms 0ms cubic-bezier(0.4, 0, 0.6, 1);
  transform: translateX(100%);
}
[dir=rtl] .mdc-switch--selected .mdc-switch--selected .mdc-switch__track::before {
  transform: translateX(-100%);
}
.mdc-switch--selected .mdc-switch__track::before {
  opacity: var(--mat-slide-toggle-hidden-track-opacity, 0);
  transition: var(--mat-slide-toggle-hidden-track-transition, opacity 75ms);
}
.mdc-switch--unselected .mdc-switch__track::before {
  opacity: var(--mat-slide-toggle-visible-track-opacity, 1);
  transition: var(--mat-slide-toggle-visible-track-transition, opacity 75ms);
}
.mdc-switch:enabled:hover:not(:focus):not(:active) .mdc-switch__track::before {
  background: var(--mat-slide-toggle-unselected-hover-track-color, var(--mat-sys-surface-variant));
}
.mdc-switch:enabled:focus:not(:active) .mdc-switch__track::before {
  background: var(--mat-slide-toggle-unselected-focus-track-color, var(--mat-sys-surface-variant));
}
.mdc-switch:enabled:active .mdc-switch__track::before {
  background: var(--mat-slide-toggle-unselected-pressed-track-color, var(--mat-sys-surface-variant));
}
.mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled:hover:not(:focus):not(:active) .mdc-switch__track::before, .mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled:focus:not(:active) .mdc-switch__track::before, .mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled:active .mdc-switch__track::before, .mdc-switch.mdc-switch--disabled .mdc-switch__track::before {
  background: var(--mat-slide-toggle-disabled-unselected-track-color, var(--mat-sys-surface-variant));
}
.mdc-switch__track::after {
  transform: translateX(-100%);
  background: var(--mat-slide-toggle-selected-track-color, var(--mat-sys-primary));
}
[dir=rtl] .mdc-switch__track::after {
  transform: translateX(100%);
}
.mdc-switch--selected .mdc-switch__track::after {
  transform: translateX(0);
}
.mdc-switch--selected .mdc-switch__track::after {
  opacity: var(--mat-slide-toggle-visible-track-opacity, 1);
  transition: var(--mat-slide-toggle-visible-track-transition, opacity 75ms);
}
.mdc-switch--unselected .mdc-switch__track::after {
  opacity: var(--mat-slide-toggle-hidden-track-opacity, 0);
  transition: var(--mat-slide-toggle-hidden-track-transition, opacity 75ms);
}
.mdc-switch:enabled:hover:not(:focus):not(:active) .mdc-switch__track::after {
  background: var(--mat-slide-toggle-selected-hover-track-color, var(--mat-sys-primary));
}
.mdc-switch:enabled:focus:not(:active) .mdc-switch__track::after {
  background: var(--mat-slide-toggle-selected-focus-track-color, var(--mat-sys-primary));
}
.mdc-switch:enabled:active .mdc-switch__track::after {
  background: var(--mat-slide-toggle-selected-pressed-track-color, var(--mat-sys-primary));
}
.mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled:hover:not(:focus):not(:active) .mdc-switch__track::after, .mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled:focus:not(:active) .mdc-switch__track::after, .mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled:active .mdc-switch__track::after, .mdc-switch.mdc-switch--disabled .mdc-switch__track::after {
  background: var(--mat-slide-toggle-disabled-selected-track-color, var(--mat-sys-on-surface));
}

.mdc-switch__handle-track {
  height: 100%;
  pointer-events: none;
  position: absolute;
  top: 0;
  transition: transform 75ms 0ms cubic-bezier(0.4, 0, 0.2, 1);
  left: 0;
  right: auto;
  transform: translateX(0);
  width: calc(100% - var(--mat-slide-toggle-handle-width));
}
[dir=rtl] .mdc-switch__handle-track {
  left: auto;
  right: 0;
}
.mdc-switch--selected .mdc-switch__handle-track {
  transform: translateX(100%);
}
[dir=rtl] .mdc-switch--selected .mdc-switch__handle-track {
  transform: translateX(-100%);
}

.mdc-switch__handle {
  display: flex;
  pointer-events: auto;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: 0;
  right: auto;
  transition: width 75ms cubic-bezier(0.4, 0, 0.2, 1), height 75ms cubic-bezier(0.4, 0, 0.2, 1), margin 75ms cubic-bezier(0.4, 0, 0.2, 1);
  width: var(--mat-slide-toggle-handle-width);
  height: var(--mat-slide-toggle-handle-height);
  border-radius: var(--mat-slide-toggle-handle-shape, var(--mat-sys-corner-full));
}
[dir=rtl] .mdc-switch__handle {
  left: auto;
  right: 0;
}
.mat-mdc-slide-toggle .mdc-switch--unselected .mdc-switch__handle {
  width: var(--mat-slide-toggle-unselected-handle-size, 16px);
  height: var(--mat-slide-toggle-unselected-handle-size, 16px);
  margin: var(--mat-slide-toggle-unselected-handle-horizontal-margin, 0 8px);
}
.mat-mdc-slide-toggle .mdc-switch--unselected .mdc-switch__handle:has(.mdc-switch__icons) {
  margin: var(--mat-slide-toggle-unselected-with-icon-handle-horizontal-margin, 0 4px);
}
.mat-mdc-slide-toggle .mdc-switch--selected .mdc-switch__handle {
  width: var(--mat-slide-toggle-selected-handle-size, 24px);
  height: var(--mat-slide-toggle-selected-handle-size, 24px);
  margin: var(--mat-slide-toggle-selected-handle-horizontal-margin, 0 24px);
}
.mat-mdc-slide-toggle .mdc-switch--selected .mdc-switch__handle:has(.mdc-switch__icons) {
  margin: var(--mat-slide-toggle-selected-with-icon-handle-horizontal-margin, 0 24px);
}
.mat-mdc-slide-toggle .mdc-switch__handle:has(.mdc-switch__icons) {
  width: var(--mat-slide-toggle-with-icon-handle-size, 24px);
  height: var(--mat-slide-toggle-with-icon-handle-size, 24px);
}
.mat-mdc-slide-toggle .mdc-switch:active:not(.mdc-switch--disabled) .mdc-switch__handle {
  width: var(--mat-slide-toggle-pressed-handle-size, 28px);
  height: var(--mat-slide-toggle-pressed-handle-size, 28px);
}
.mat-mdc-slide-toggle .mdc-switch--selected:active:not(.mdc-switch--disabled) .mdc-switch__handle {
  margin: var(--mat-slide-toggle-selected-pressed-handle-horizontal-margin, 0 22px);
}
.mat-mdc-slide-toggle .mdc-switch--unselected:active:not(.mdc-switch--disabled) .mdc-switch__handle {
  margin: var(--mat-slide-toggle-unselected-pressed-handle-horizontal-margin, 0 2px);
}
.mdc-switch--disabled.mdc-switch--selected .mdc-switch__handle::after {
  opacity: var(--mat-slide-toggle-disabled-selected-handle-opacity, 1);
}
.mdc-switch--disabled.mdc-switch--unselected .mdc-switch__handle::after {
  opacity: var(--mat-slide-toggle-disabled-unselected-handle-opacity, 0.38);
}
.mdc-switch__handle::before, .mdc-switch__handle::after {
  border: 1px solid transparent;
  border-radius: inherit;
  box-sizing: border-box;
  content: "";
  width: 100%;
  height: 100%;
  left: 0;
  position: absolute;
  top: 0;
  transition: background-color 75ms 0ms cubic-bezier(0.4, 0, 0.2, 1), border-color 75ms 0ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: -1;
}
@media (forced-colors: active) {
  .mdc-switch__handle::before, .mdc-switch__handle::after {
    border-color: currentColor;
  }
}
.mdc-switch--selected:enabled .mdc-switch__handle::after {
  background: var(--mat-slide-toggle-selected-handle-color, var(--mat-sys-on-primary));
}
.mdc-switch--selected:enabled:hover:not(:focus):not(:active) .mdc-switch__handle::after {
  background: var(--mat-slide-toggle-selected-hover-handle-color, var(--mat-sys-primary-container));
}
.mdc-switch--selected:enabled:focus:not(:active) .mdc-switch__handle::after {
  background: var(--mat-slide-toggle-selected-focus-handle-color, var(--mat-sys-primary-container));
}
.mdc-switch--selected:enabled:active .mdc-switch__handle::after {
  background: var(--mat-slide-toggle-selected-pressed-handle-color, var(--mat-sys-primary-container));
}
.mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled.mdc-switch--selected:hover:not(:focus):not(:active) .mdc-switch__handle::after, .mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled.mdc-switch--selected:focus:not(:active) .mdc-switch__handle::after, .mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled.mdc-switch--selected:active .mdc-switch__handle::after, .mdc-switch--selected.mdc-switch--disabled .mdc-switch__handle::after {
  background: var(--mat-slide-toggle-disabled-selected-handle-color, var(--mat-sys-surface));
}
.mdc-switch--unselected:enabled .mdc-switch__handle::after {
  background: var(--mat-slide-toggle-unselected-handle-color, var(--mat-sys-outline));
}
.mdc-switch--unselected:enabled:hover:not(:focus):not(:active) .mdc-switch__handle::after {
  background: var(--mat-slide-toggle-unselected-hover-handle-color, var(--mat-sys-on-surface-variant));
}
.mdc-switch--unselected:enabled:focus:not(:active) .mdc-switch__handle::after {
  background: var(--mat-slide-toggle-unselected-focus-handle-color, var(--mat-sys-on-surface-variant));
}
.mdc-switch--unselected:enabled:active .mdc-switch__handle::after {
  background: var(--mat-slide-toggle-unselected-pressed-handle-color, var(--mat-sys-on-surface-variant));
}
.mdc-switch--unselected.mdc-switch--disabled .mdc-switch__handle::after {
  background: var(--mat-slide-toggle-disabled-unselected-handle-color, var(--mat-sys-on-surface));
}
.mdc-switch__handle::before {
  background: var(--mat-slide-toggle-handle-surface-color);
}

.mdc-switch__shadow {
  border-radius: inherit;
  bottom: 0;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}
.mdc-switch:enabled .mdc-switch__shadow {
  box-shadow: var(--mat-slide-toggle-handle-elevation-shadow);
}
.mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled:hover:not(:focus):not(:active) .mdc-switch__shadow, .mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled:focus:not(:active) .mdc-switch__shadow, .mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled:active .mdc-switch__shadow, .mdc-switch.mdc-switch--disabled .mdc-switch__shadow {
  box-shadow: var(--mat-slide-toggle-disabled-handle-elevation-shadow);
}

.mdc-switch__ripple {
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: -1;
  width: var(--mat-slide-toggle-state-layer-size, 40px);
  height: var(--mat-slide-toggle-state-layer-size, 40px);
}
.mdc-switch__ripple::after {
  content: "";
  opacity: 0;
}
.mdc-switch--disabled .mdc-switch__ripple::after {
  display: none;
}
.mat-mdc-slide-toggle-disabled-interactive .mdc-switch__ripple::after {
  display: block;
}
.mdc-switch:hover .mdc-switch__ripple::after {
  transition: 75ms opacity cubic-bezier(0, 0, 0.2, 1);
}
.mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled:enabled:focus .mdc-switch__ripple::after, .mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled:enabled:active .mdc-switch__ripple::after, .mat-mdc-slide-toggle-disabled-interactive.mdc-switch--disabled:enabled:hover:not(:focus) .mdc-switch__ripple::after, .mdc-switch--unselected:enabled:hover:not(:focus) .mdc-switch__ripple::after {
  background: var(--mat-slide-toggle-unselected-hover-state-layer-color, var(--mat-sys-on-surface));
  opacity: var(--mat-slide-toggle-unselected-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mdc-switch--unselected:enabled:focus .mdc-switch__ripple::after {
  background: var(--mat-slide-toggle-unselected-focus-state-layer-color, var(--mat-sys-on-surface));
  opacity: var(--mat-slide-toggle-unselected-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mdc-switch--unselected:enabled:active .mdc-switch__ripple::after {
  background: var(--mat-slide-toggle-unselected-pressed-state-layer-color, var(--mat-sys-on-surface));
  opacity: var(--mat-slide-toggle-unselected-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
  transition: opacity 75ms linear;
}
.mdc-switch--selected:enabled:hover:not(:focus) .mdc-switch__ripple::after {
  background: var(--mat-slide-toggle-selected-hover-state-layer-color, var(--mat-sys-primary));
  opacity: var(--mat-slide-toggle-selected-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mdc-switch--selected:enabled:focus .mdc-switch__ripple::after {
  background: var(--mat-slide-toggle-selected-focus-state-layer-color, var(--mat-sys-primary));
  opacity: var(--mat-slide-toggle-selected-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mdc-switch--selected:enabled:active .mdc-switch__ripple::after {
  background: var(--mat-slide-toggle-selected-pressed-state-layer-color, var(--mat-sys-primary));
  opacity: var(--mat-slide-toggle-selected-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
  transition: opacity 75ms linear;
}

.mdc-switch__icons {
  position: relative;
  height: 100%;
  width: 100%;
  z-index: 1;
  transform: translateZ(0);
}
.mdc-switch--disabled.mdc-switch--unselected .mdc-switch__icons {
  opacity: var(--mat-slide-toggle-disabled-unselected-icon-opacity, 0.38);
}
.mdc-switch--disabled.mdc-switch--selected .mdc-switch__icons {
  opacity: var(--mat-slide-toggle-disabled-selected-icon-opacity, 0.38);
}

.mdc-switch__icon {
  bottom: 0;
  left: 0;
  margin: auto;
  position: absolute;
  right: 0;
  top: 0;
  opacity: 0;
  transition: opacity 30ms 0ms cubic-bezier(0.4, 0, 1, 1);
}
.mdc-switch--unselected .mdc-switch__icon {
  width: var(--mat-slide-toggle-unselected-icon-size, 16px);
  height: var(--mat-slide-toggle-unselected-icon-size, 16px);
  fill: var(--mat-slide-toggle-unselected-icon-color, var(--mat-sys-surface-variant));
}
.mdc-switch--unselected.mdc-switch--disabled .mdc-switch__icon {
  fill: var(--mat-slide-toggle-disabled-unselected-icon-color, var(--mat-sys-surface-variant));
}
.mdc-switch--selected .mdc-switch__icon {
  width: var(--mat-slide-toggle-selected-icon-size, 16px);
  height: var(--mat-slide-toggle-selected-icon-size, 16px);
  fill: var(--mat-slide-toggle-selected-icon-color, var(--mat-sys-on-primary-container));
}
.mdc-switch--selected.mdc-switch--disabled .mdc-switch__icon {
  fill: var(--mat-slide-toggle-disabled-selected-icon-color, var(--mat-sys-on-surface));
}

.mdc-switch--selected .mdc-switch__icon--on,
.mdc-switch--unselected .mdc-switch__icon--off {
  opacity: 1;
  transition: opacity 45ms 30ms cubic-bezier(0, 0, 0.2, 1);
}

.mat-mdc-slide-toggle {
  -webkit-user-select: none;
  user-select: none;
  display: inline-block;
  -webkit-tap-highlight-color: transparent;
  outline: 0;
}
.mat-mdc-slide-toggle .mat-mdc-slide-toggle-ripple,
.mat-mdc-slide-toggle .mdc-switch__ripple::after {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.mat-mdc-slide-toggle .mat-mdc-slide-toggle-ripple:not(:empty),
.mat-mdc-slide-toggle .mdc-switch__ripple::after:not(:empty) {
  transform: translateZ(0);
}
.mat-mdc-slide-toggle.mat-mdc-slide-toggle-focused .mat-focus-indicator::before {
  content: "";
}
.mat-mdc-slide-toggle .mat-internal-form-field {
  color: var(--mat-slide-toggle-label-text-color, var(--mat-sys-on-surface));
  font-family: var(--mat-slide-toggle-label-text-font, var(--mat-sys-body-medium-font));
  line-height: var(--mat-slide-toggle-label-text-line-height, var(--mat-sys-body-medium-line-height));
  font-size: var(--mat-slide-toggle-label-text-size, var(--mat-sys-body-medium-size));
  letter-spacing: var(--mat-slide-toggle-label-text-tracking, var(--mat-sys-body-medium-tracking));
  font-weight: var(--mat-slide-toggle-label-text-weight, var(--mat-sys-body-medium-weight));
}
.mat-mdc-slide-toggle .mat-ripple-element {
  opacity: 0.12;
}
.mat-mdc-slide-toggle .mat-focus-indicator::before {
  border-radius: 50%;
}
.mat-mdc-slide-toggle._mat-animation-noopable .mdc-switch__handle-track,
.mat-mdc-slide-toggle._mat-animation-noopable .mdc-switch__icon,
.mat-mdc-slide-toggle._mat-animation-noopable .mdc-switch__handle::before,
.mat-mdc-slide-toggle._mat-animation-noopable .mdc-switch__handle::after,
.mat-mdc-slide-toggle._mat-animation-noopable .mdc-switch__track::before,
.mat-mdc-slide-toggle._mat-animation-noopable .mdc-switch__track::after {
  transition: none;
}
.mat-mdc-slide-toggle .mdc-switch:enabled + .mdc-label {
  cursor: pointer;
}
.mat-mdc-slide-toggle .mdc-switch--disabled + label {
  color: var(--mat-slide-toggle-disabled-label-text-color, var(--mat-sys-on-surface));
}
.mat-mdc-slide-toggle label:empty {
  display: none;
}

.mat-mdc-slide-toggle-touch-target {
  position: absolute;
  top: 50%;
  left: 50%;
  height: var(--mat-slide-toggle-touch-target-size, 48px);
  width: 100%;
  transform: translate(-50%, -50%);
  display: var(--mat-slide-toggle-touch-target-display, block);
}
[dir=rtl] .mat-mdc-slide-toggle-touch-target {
  left: auto;
  right: 50%;
  transform: translate(50%, -50%);
}
`],encapsulation:2,changeDetection:0})}return n})(),pt=(()=>{class n{static \u0275fac=function(o){return new(o||n)};static \u0275mod=j({type:n});static \u0275inj=L({imports:[V,se]})}return n})();var Ct=(n,r)=>r.id;function xt(n,r){n&1&&m(0,"mat-spinner",6)}function wt(n,r){if(n&1&&m(0,"img",13),n&2){let e=s(2);g("src",e.client().logo_url,Z)}}function yt(n,r){if(n&1&&(t(0,"div",14),l(1),i()),n&2){let e,o=s(2);d(),v((e=o.client().name)==null?null:e[0])}}function kt(n,r){n&1&&m(0,"mat-spinner",16)}function St(n,r){n&1&&(t(0,"mat-icon",17),l(1,"photo_camera"),i())}function Et(n,r){if(n&1&&(t(0,"span",21),l(1),i()),n&2){let e=s(2);d(),k("GSTIN: ",e.client().gstin)}}function Dt(n,r){if(n&1){let e=w();t(0,"div",7)(1,"div",12),u(2,wt,1,1,"img",13)(3,yt,2,1,"div",14),t(4,"button",15),c("click",function(){p(e);let a=T(8);return _(a.click())}),u(5,kt,1,0,"mat-spinner",16)(6,St,2,0,"mat-icon",17),i(),t(7,"input",18,0),c("change",function(a){p(e);let f=s();return _(f.onLogoUpload(a))}),i()(),t(9,"div")(10,"h2"),l(11),i(),t(12,"div",19)(13,"span",20),l(14),i(),u(15,Et,2,1,"span",21),t(16,"mat-chip",22),l(17),i()()()()}if(n&2){let e=s();d(2),h(e.client().logo_url?2:3),d(2),g("disabled",e.uploadingLogo()),d(),h(e.uploadingLogo()?5:6),d(6),v(e.client().name),d(3),v(e.client().code),d(),h(e.client().gstin?15:-1),d(),P(e.client().is_active?"status-approved":"status-rejected"),g("highlighted",!0),d(),k(" ",e.client().is_active?"Active":"Inactive"," ")}}function Mt(n,r){if(n&1){let e=w();t(0,"div",8)(1,"button",23),c("click",function(){p(e);let a=s();return _(a.raisePo())}),t(2,"mat-icon"),l(3,"add_shopping_cart"),i(),l(4," Raise PO on Behalf "),i(),t(5,"button",24),c("click",function(){p(e);let a=s();return _(a.openEditDialog())}),t(6,"mat-icon"),l(7,"edit"),i(),l(8," Edit Client "),i()()}}function Tt(n,r){n&1&&(t(0,"div",9),m(1,"mat-spinner",25),t(2,"span"),l(3,"Loading client details\u2026"),i()())}function It(n,r){if(n&1){let e=w();t(0,"div",10)(1,"mat-icon"),l(2,"error_outline"),i(),t(3,"p"),l(4),i(),t(5,"button",24),c("click",function(){p(e);let a=s();return _(a.loadClientData(+a.id()))}),l(6,"Retry"),i()()}if(n&2){let e=s();d(4),v(e.loadError())}}function zt(n,r){n&1&&(t(0,"div",34)(1,"mat-icon"),l(2,"person_off"),i(),t(3,"p"),l(4,"No client users yet"),i()())}function Pt(n,r){n&1&&(t(0,"th",46),l(1,"User"),i())}function Ot(n,r){if(n&1&&(t(0,"td",47)(1,"div",48)(2,"div",49),l(3),i(),t(4,"div")(5,"div",50),l(6),i(),t(7,"div",51),l(8),i()()()()),n&2){let e=r.$implicit;d(3),v(e.user==null||e.user.name==null?null:e.user.name[0]),d(3),v(e.user==null?null:e.user.name),d(2),v(e.user==null?null:e.user.email)}}function Rt(n,r){n&1&&(t(0,"th",46),l(1,"Role"),i())}function At(n,r){if(n&1&&(t(0,"td",47)(1,"span",52),l(2),i()()),n&2){let e=r.$implicit,o=s(3);d(2),v(o.roleLabel(e.role))}}function Vt(n,r){n&1&&m(0,"th",46)}function Ft(n,r){if(n&1){let e=w();t(0,"td",53)(1,"button",54),c("click",function(){let a=p(e).$implicit,f=s(3);return _(f.openEditRoleDialog(a))}),t(2,"mat-icon",55),l(3,"edit"),i()(),t(4,"button",56),c("click",function(){let a=p(e).$implicit,f=s(3);return _(f.removeAssignment(a))}),t(5,"mat-icon",55),l(6,"person_off"),i()()()}}function Lt(n,r){n&1&&m(0,"tr",57)}function Ut(n,r){n&1&&m(0,"tr",58)}function Nt(n,r){if(n&1&&(t(0,"table",35),E(1,38),y(2,Pt,2,0,"th",39)(3,Ot,9,3,"td",40),D(),E(4,41),y(5,Rt,2,0,"th",39)(6,At,3,1,"td",40),D(),E(7,42),y(8,Vt,1,0,"th",39)(9,Ft,7,0,"td",43),D(),y(10,Lt,1,0,"tr",44)(11,Ut,1,0,"tr",45),i()),n&2){let e=s(2);g("dataSource",e.clientUsers()),d(10),g("matHeaderRowDef",e.clientColumns),d(),g("matRowDefColumns",e.clientColumns)}}function qt(n,r){n&1&&(t(0,"div",34)(1,"mat-icon"),l(2,"group_off"),i(),t(3,"p"),l(4,"No ZOPA staff assigned"),i()())}function Gt(n,r){n&1&&(t(0,"th",46),l(1,"Staff Member"),i())}function Zt(n,r){if(n&1&&(t(0,"td",47)(1,"div",48)(2,"div",60),l(3),i(),t(4,"span"),l(5),i()()()),n&2){let e=r.$implicit;d(3),v(e.user==null||e.user.name==null?null:e.user.name[0]),d(2),v(e.user==null?null:e.user.name)}}function jt(n,r){n&1&&(t(0,"th",46),l(1,"Role"),i())}function Bt(n,r){if(n&1&&(t(0,"td",47)(1,"span",61),l(2),i()()),n&2){let e=r.$implicit,o=s(3);d(2),v(o.roleLabel(e.role))}}function Ht(n,r){n&1&&m(0,"th",46)}function $t(n,r){if(n&1){let e=w();t(0,"td",53)(1,"button",62),c("click",function(){let a=p(e).$implicit,f=s(3);return _(f.removeAssignment(a))}),t(2,"mat-icon",55),l(3,"delete"),i()()()}}function Xt(n,r){n&1&&m(0,"tr",57)}function Qt(n,r){n&1&&m(0,"tr",58)}function Wt(n,r){if(n&1&&(t(0,"table",35),E(1,59),y(2,Gt,2,0,"th",39)(3,Zt,6,2,"td",40),D(),E(4,41),y(5,jt,2,0,"th",39)(6,Bt,3,1,"td",40),D(),E(7,42),y(8,Ht,1,0,"th",39)(9,$t,4,0,"td",43),D(),y(10,Xt,1,0,"tr",44)(11,Qt,1,0,"tr",45),i()),n&2){let e=s(2);g("dataSource",e.zopaStaff()),d(10),g("matHeaderRowDef",e.zopaColumns),d(),g("matRowDefColumns",e.zopaColumns)}}function Yt(n,r){if(n&1){let e=w();t(0,"div",26)(1,"div",27)(2,"mat-icon"),l(3,"receipt_long"),i(),t(4,"span"),l(5,"PO Prefix: "),t(6,"strong"),l(7),i()()(),t(8,"div",27)(9,"mat-icon"),l(10,"calendar_today"),i(),t(11,"span"),l(12,"FY Start Month: "),t(13,"strong"),l(14),i()()(),t(15,"div",27)(16,"mat-icon"),l(17,"group"),i(),t(18,"span"),l(19,"Total Users: "),t(20,"strong"),l(21),i()()()(),t(22,"div",28)(23,"mat-card",29)(24,"mat-card-header")(25,"mat-card-title")(26,"mat-icon",30),l(27,"people"),i(),l(28," Client Users "),i(),m(29,"div",31),t(30,"button",32),c("click",function(){p(e);let a=s();return _(a.openCreateUserDialog())}),t(31,"mat-icon"),l(32,"person_add"),i(),l(33," Add User "),i()(),t(34,"mat-card-content",33),u(35,zt,5,0,"div",34)(36,Nt,12,3,"table",35),i()(),t(37,"mat-card",29)(38,"mat-card-header")(39,"mat-card-title")(40,"mat-icon",36),l(41,"verified_user"),i(),l(42," ZOPA Staff Assigned "),i(),m(43,"div",31),t(44,"button",37),c("click",function(){p(e);let a=s();return _(a.openAssignStaffDialog())}),t(45,"mat-icon"),l(46,"add"),i(),l(47," Assign "),i()(),t(48,"mat-card-content",33),u(49,qt,5,0,"div",34)(50,Wt,12,3,"table",35),i()()()}if(n&2){let e=s();d(7),v(e.client().po_prefix||"\u2014"),d(7),v(e.client().fiscal_year_start||"\u2014"),d(7),v(e.allUsers().length),d(14),h(e.clientUsers().length===0?35:36),d(14),h(e.zopaStaff().length===0?49:50)}}function Jt(n,r){if(n&1&&(t(0,"mat-option",73),l(1),i()),n&2){let e=r.$implicit;g("value",e.id),d(),v(e.name)}}function Kt(n,r){n&1&&(t(0,"mat-option",78),l(1,"ZOPA L3 Approver"),i())}function ei(n,r){n&1&&m(0,"mat-spinner",82)}function ti(n,r){n&1&&l(0," Assign ")}function ii(n,r){if(n&1){let e=w();t(0,"div",63),c("click",function(){p(e);let a=s();return _(a.showAssignDialog.set(!1))}),t(1,"mat-card",64),c("click",function(a){return a.stopPropagation()}),t(2,"mat-card-header")(3,"div",65)(4,"div",66)(5,"mat-icon",67),l(6,"verified_user"),i()(),t(7,"div")(8,"mat-card-title"),l(9,"Assign ZOPA Staff"),i(),t(10,"p",68),l(11,"Grant a ZOPA team member access to this client"),i()()()(),t(12,"mat-card-content",69)(13,"form",70)(14,"mat-form-field",71)(15,"mat-label"),l(16,"Staff Member"),i(),t(17,"mat-select",72),B(18,Jt,2,2,"mat-option",73,Ct),i()(),t(20,"mat-form-field",71)(21,"mat-label"),l(22,"Role for this Client"),i(),t(23,"mat-select",74)(24,"mat-option",75),l(25,"ZOPA Buyer"),i(),t(26,"mat-option",76),l(27,"ZOPA L1 Approver"),i(),t(28,"mat-option",77),l(29,"ZOPA L2 Approver"),i(),u(30,Kt,2,0,"mat-option",78),i(),t(31,"mat-hint"),l(32,"Defines the staff member's role within this specific client org"),i()()()(),t(33,"mat-card-actions",79)(34,"button",80),c("click",function(){p(e);let a=s();return _(a.showAssignDialog.set(!1))}),l(35,"Cancel"),i(),t(36,"button",81),c("click",function(){p(e);let a=s();return _(a.onAssignStaff())}),u(37,ei,1,0,"mat-spinner",82)(38,ti,1,0),i()()()()}if(n&2){let e,o=s();d(13),g("formGroup",o.assignForm),d(5),H(o.availableStaff()),d(12),h((e=o.client())!=null&&e.is_internal?30:-1),d(6),g("disabled",o.assignForm.invalid||o.saving()),d(),h(o.saving()?37:38)}}function ni(n,r){if(n&1&&(t(0,"div",95)(1,"mat-icon"),l(2,"error_outline"),i(),l(3),i()),n&2){let e=s(2);d(3),k(" ",e.saveError()," ")}}function ai(n,r){n&1&&m(0,"mat-spinner",82)}function oi(n,r){n&1&&l(0," Create User ")}function li(n,r){if(n&1){let e=w();t(0,"div",63),c("click",function(){p(e);let a=s();return _(a.showCreateUserDialog.set(!1))}),t(1,"mat-card",64),c("click",function(a){return a.stopPropagation()}),t(2,"mat-card-header")(3,"div",65)(4,"div",83)(5,"mat-icon",84),l(6,"person_add"),i()(),t(7,"div")(8,"mat-card-title"),l(9,"Add Client User"),i(),t(10,"p",68),l(11),i()()()(),t(12,"mat-card-content",69)(13,"form",70)(14,"div",85)(15,"mat-form-field",86)(16,"mat-label"),l(17,"Full Name *"),i(),m(18,"input",87),i(),t(19,"mat-form-field",86)(20,"mat-label"),l(21,"Role *"),i(),t(22,"mat-select",74)(23,"mat-option",88),l(24,"Admin"),i(),t(25,"mat-option",89),l(26,"Buyer"),i(),t(27,"mat-option",90),l(28,"L1 Approver"),i(),t(29,"mat-option",91),l(30,"L2 Approver"),i(),t(31,"mat-option",92),l(32,"L3 Approver"),i()()()(),t(33,"mat-form-field",71)(34,"mat-label"),l(35,"Email *"),i(),m(36,"input",93),i(),t(37,"mat-form-field",71)(38,"mat-label"),l(39,"Password *"),i(),m(40,"input",94),t(41,"mat-hint"),l(42,"Minimum 8 characters"),i()()(),u(43,ni,4,1,"div",95),i(),t(44,"mat-card-actions",79)(45,"button",80),c("click",function(){p(e);let a=s();return _(a.showCreateUserDialog.set(!1))}),l(46,"Cancel"),i(),t(47,"button",81),c("click",function(){p(e);let a=s();return _(a.onCreateUser())}),u(48,ai,1,0,"mat-spinner",82)(49,oi,1,0),i()()()()}if(n&2){let e,o=s();d(11),k("Create a new user for ",(e=o.client())==null?null:e.name),d(2),g("formGroup",o.createUserForm),d(30),h(o.saveError()?43:-1),d(4),g("disabled",o.createUserForm.invalid||o.saving()),d(),h(o.saving()?48:49)}}function ri(n,r){n&1&&(t(0,"mat-error"),l(1,"Invalid GSTIN format"),i())}function di(n,r){n&1&&m(0,"mat-spinner",82)}function si(n,r){n&1&&l(0," Save Changes ")}function ci(n,r){if(n&1){let e=w();t(0,"div",63),c("click",function(){p(e);let a=s();return _(a.showEditDialog.set(!1))}),t(1,"mat-card",64),c("click",function(a){return a.stopPropagation()}),t(2,"mat-card-header")(3,"div",65)(4,"div",96)(5,"mat-icon",97),l(6,"edit"),i()(),t(7,"div")(8,"mat-card-title"),l(9,"Edit Client"),i(),t(10,"p",68),l(11),i()()()(),t(12,"mat-card-content",69)(13,"form",70)(14,"div",85)(15,"mat-form-field",86)(16,"mat-label"),l(17,"Client Code *"),i(),m(18,"input",98),i(),t(19,"mat-form-field",86)(20,"mat-label"),l(21,"PO Prefix"),i(),m(22,"input",99),i()(),t(23,"mat-form-field",71)(24,"mat-label"),l(25,"Company Name *"),i(),m(26,"input",87),i(),t(27,"mat-form-field",71)(28,"mat-label"),l(29,"GSTIN"),i(),m(30,"input",100),u(31,ri,2,0,"mat-error"),i(),t(32,"div",101)(33,"button",102),c("click",function(){p(e);let a=T(40);return _(a.click())}),t(34,"mat-icon"),l(35,"image"),i(),l(36," Select Logo "),i(),t(37,"span",103),l(38),i(),t(39,"input",18,1),c("change",function(a){p(e);let f=s();return _(f.onFileSelected(a))}),i()(),t(41,"div",104)(42,"div")(43,"div",105),l(44,"ZOPA Internal Org"),i(),t(45,"div",106),l(46,"ZOPA staff can be assigned L3 approver role for internal orgs"),i()(),m(47,"mat-slide-toggle",107),i()()(),t(48,"mat-card-actions",79)(49,"button",80),c("click",function(){p(e);let a=s();return _(a.showEditDialog.set(!1))}),l(50,"Cancel"),i(),t(51,"button",81),c("click",function(){p(e);let a=s();return _(a.onEditClient())}),u(52,di,1,0,"mat-spinner",82)(53,si,1,0),i()()()()}if(n&2){let e,o,a=s();d(11),k("Update ",(e=a.client())==null?null:e.name," details"),d(2),g("formGroup",a.editForm),d(18),h(!((o=a.editForm.get("gstin"))==null||o.errors==null)&&o.errors.gstin&&((o=a.editForm.get("gstin"))!=null&&o.touched)?31:-1),d(7),k(" ",a.selectedFileName()||"No file chosen (Optional)"," "),d(13),g("disabled",a.editForm.invalid||a.saving()),d(),h(a.saving()?52:53)}}function mi(n,r){if(n&1&&(t(0,"div",95)(1,"mat-icon"),l(2,"error_outline"),i(),l(3),i()),n&2){let e=s(2);d(3),k(" ",e.saveError()," ")}}function pi(n,r){n&1&&m(0,"mat-spinner",82)}function _i(n,r){n&1&&l(0," Save Role ")}function gi(n,r){if(n&1){let e=w();t(0,"div",63),c("click",function(){p(e);let a=s();return _(a.showEditRoleDialog.set(!1))}),t(1,"mat-card",108),c("click",function(a){return a.stopPropagation()}),t(2,"mat-card-header")(3,"div",65)(4,"div",109)(5,"mat-icon",84),l(6,"manage_accounts"),i()(),t(7,"div")(8,"mat-card-title"),l(9,"Change Role"),i(),t(10,"p",68),l(11),i()()()(),t(12,"mat-card-content",69)(13,"form",70)(14,"mat-form-field",71)(15,"mat-label"),l(16,"Role"),i(),t(17,"mat-select",74)(18,"mat-option",88),l(19,"Client Admin"),i(),t(20,"mat-option",89),l(21,"Client Buyer"),i(),t(22,"mat-option",90),l(23,"L1 Approver"),i(),t(24,"mat-option",91),l(25,"L2 Approver"),i(),t(26,"mat-option",92),l(27,"L3 Approver (Final)"),i()()()(),u(28,mi,4,1,"div",95),i(),t(29,"mat-card-actions",79)(30,"button",80),c("click",function(){p(e);let a=s();return _(a.showEditRoleDialog.set(!1))}),l(31,"Cancel"),i(),t(32,"button",81),c("click",function(){p(e);let a=s();return _(a.onSaveRole())}),u(33,pi,1,0,"mat-spinner",82)(34,_i,1,0),i()()()()}if(n&2){let e,o=s();d(11),v((e=o.editingRel())==null||e.user==null?null:e.user.name),d(2),g("formGroup",o.editRoleForm),d(15),h(o.saveError()?28:-1),d(4),g("disabled",o.editRoleForm.invalid||o.saving()),d(),h(o.saving()?33:34)}}var _t=class n{id=te.required();adminService=C(mt);auth=C(he);router=C(ae);fb=C(Se);client=b(null);allUsers=b([]);zopaStaff=b([]);clientUsers=b([]);availableStaff=b([]);loading=b(!0);loadError=b("");saving=b(!1);saveError=b("");uploadingLogo=b(!1);showAssignDialog=b(!1);showCreateUserDialog=b(!1);showEditDialog=b(!1);showEditRoleDialog=b(!1);editingRel=b(null);zopaColumns=["name","role","actions"];clientColumns=["user","role","actions"];assignForm=this.fb.group({user_id:["",x.required],role:["zopa_buyer",x.required]});createUserForm=this.fb.group({name:["",x.required],email:["",[x.required,x.email]],password:["",[x.required,x.minLength(8)]],role:["client_buyer",x.required]});editForm=this.fb.group({code:["",x.required],name:["",x.required],gstin:["",ct()],po_prefix:[""],is_internal:[!1]});editRoleForm=this.fb.group({role:["",x.required]});roleLabel(r){return{zopa_super_admin:"Super Admin",zopa_buyer:"ZOPA Buyer",zopa_approver_l1:"ZOPA L1 Approver",zopa_approver_l2:"ZOPA L2 Approver",zopa_approver_l3:"ZOPA L3 Approver",client_admin:"Admin",client_buyer:"Buyer",client_approver_l1:"L1 Approver",client_approver_l2:"L2 Approver",client_approver_l3:"L3 Approver"}[r]??r}ngOnInit(){this.loadClientData(+this.id())}loadClientData(r){this.loading.set(!0),this.loadError.set(""),this.adminService.getClient(r).subscribe({next:e=>{this.client.set(e),this.editForm.patchValue({code:e.code,name:e.name,gstin:e.gstin,po_prefix:e.po_prefix,is_internal:e.is_internal}),this.loading.set(!1)},error:()=>{this.loadError.set("Could not load client details. The client may not exist."),this.loading.set(!1)}}),this.adminService.getClientUsers(r).subscribe({next:e=>{this.allUsers.set(e),this.zopaStaff.set(e.filter(o=>o.role.startsWith("zopa_"))),this.clientUsers.set(e.filter(o=>o.role.startsWith("client_")))}})}raisePo(){let r=this.client();r&&(this.auth.impersonateClient(r.id,r.name),this.router.navigate(["/purchase-orders/create"]))}openAssignStaffDialog(){this.assignForm.reset({role:"zopa_buyer"});let r=this.client()?.id;this.adminService.getZopaStaff(r).subscribe({next:e=>{let o=new Set(this.zopaStaff().map(a=>a.user_id));this.availableStaff.set(e.filter(a=>!o.has(a.id))),this.showAssignDialog.set(!0)},error:()=>this.showAssignDialog.set(!0)})}onAssignStaff(){let r=this.client();this.assignForm.invalid||!r||(this.saving.set(!0),this.adminService.assignZopaStaff(r.id,this.assignForm.value).subscribe({next:e=>{this.allUsers.update(o=>[...o,e]),this.zopaStaff.update(o=>[...o,e]),this.showAssignDialog.set(!1),this.saving.set(!1)},error:e=>{alert(e.error?.message||"Error assigning staff"),this.saving.set(!1)}}))}openCreateUserDialog(){this.createUserForm.reset({role:"client_buyer"}),this.saveError.set(""),this.showCreateUserDialog.set(!0)}onCreateUser(){let r=this.client();this.createUserForm.invalid||!r||(this.saving.set(!0),this.saveError.set(""),this.adminService.createClientUser(r.id,this.createUserForm.value).subscribe({next:e=>{this.allUsers.update(o=>[...o,e]),this.clientUsers.update(o=>[...o,e]),this.showCreateUserDialog.set(!1),this.saving.set(!1)},error:e=>{this.saveError.set(e.error?.message||"Failed to create user"),this.saving.set(!1)}}))}logoFile=b(null);selectedFileName=b("");openEditDialog(){this.saveError.set(""),this.logoFile.set(null),this.selectedFileName.set(""),this.showEditDialog.set(!0)}onFileSelected(r){let e=r.target;e.files&&e.files[0]&&(this.logoFile.set(e.files[0]),this.selectedFileName.set(e.files[0].name))}onEditClient(){let r=this.client();this.editForm.invalid||!r||(this.saving.set(!0),this.adminService.updateClient(r.id,this.editForm.value).subscribe({next:e=>{let o=this.logoFile();o?this.adminService.uploadLogo(e.id,o).subscribe({next:a=>{this.client.set(a),this.showEditDialog.set(!1),this.saving.set(!1)},error:a=>{this.saveError.set(a.error?.message||"Updated details, but logo upload failed."),this.saving.set(!1)}}):(this.client.set(e),this.showEditDialog.set(!1),this.saving.set(!1))},error:e=>{this.saveError.set(e.error?.message||"Failed to update"),this.saving.set(!1)}}))}removeAssignment(r){let e=this.client();e&&this.adminService.removeUserAssignment(e.id,r.user_id,r.id).subscribe({next:()=>{this.allUsers.update(o=>o.filter(a=>a.id!==r.id)),this.zopaStaff.update(o=>o.filter(a=>a.id!==r.id)),this.clientUsers.update(o=>o.filter(a=>a.id!==r.id))},error:o=>alert("Error removing assignment: "+(o.error?.message||""))})}onLogoUpload(r){let e=r.target,o=e.files?.[0],a=this.client();!o||!a||(this.uploadingLogo.set(!0),this.adminService.uploadLogo(a.id,o).subscribe({next:f=>{this.client.set(f),this.uploadingLogo.set(!1),e.value=""},error:()=>{this.uploadingLogo.set(!1),e.value=""}}))}openEditRoleDialog(r){this.editingRel.set(r),this.editRoleForm.setValue({role:r.role}),this.saveError.set(""),this.showEditRoleDialog.set(!0)}onSaveRole(){let r=this.client(),e=this.editingRel();if(this.editRoleForm.invalid||!r||!e)return;let o=this.editRoleForm.value.role;if(o===e.role){this.showEditRoleDialog.set(!1);return}this.saving.set(!0),this.saveError.set(""),this.adminService.updateUserRole(r.id,e.user_id,e.id,o).subscribe({next:a=>{this.allUsers.update(f=>f.map(S=>S.id===e.id?a:S)),this.clientUsers.update(f=>f.map(S=>S.id===e.id?a:S)),this.showEditRoleDialog.set(!1),this.saving.set(!1)},error:a=>{this.saveError.set(a.error?.message||"Failed to update role"),this.saving.set(!1)}})}static \u0275fac=function(e){return new(e||n)};static \u0275cmp=I({type:n,selectors:[["app-client-detail"]],inputs:{id:[1,"id"]},decls:16,vars:7,consts:[["logoInput",""],["logoEditUpload",""],[1,"page-wrapper"],[1,"page-header"],[2,"display","flex","align-items","center","gap","12px"],["mat-icon-button","","routerLink","/admin/clients"],["diameter","24"],[1,"client-title-block"],[2,"display","flex","gap","10px","align-items","center"],[1,"loading-state"],[1,"error-card"],[1,"modal-overlay"],[1,"client-avatar-wrap"],["alt","logo",1,"client-logo",3,"src"],[1,"client-avatar"],["mat-icon-button","","matTooltip","Change logo",1,"logo-upload-btn",3,"click","disabled"],["diameter","16"],[2,"font-size","14px"],["type","file","accept","image/*",2,"display","none",3,"change"],[1,"client-meta"],[1,"code-tag"],[1,"gstin-tag"],[3,"highlighted"],["mat-raised-button","","color","primary",1,"raise-po-btn",3,"click"],["mat-stroked-button","",3,"click"],["diameter","40"],[1,"info-grid"],[1,"info-chip"],[1,"detail-grid"],[1,"user-card"],[2,"vertical-align","middle","margin-right","6px","color","var(--brand)"],[2,"flex","1"],["mat-stroked-button","","color","primary",2,"height","32px","font-size","12px",3,"click"],[2,"padding","0!important"],[1,"empty-panel"],["mat-table","",1,"full-width",3,"dataSource"],[2,"vertical-align","middle","margin-right","6px","color","#7c3aed"],["mat-stroked-button","",2,"height","32px","font-size","12px",3,"click"],["matColumnDef","user"],["mat-header-cell","",4,"matHeaderCellDef"],["mat-cell","",4,"matCellDef"],["matColumnDef","role"],["matColumnDef","actions"],["mat-cell","","style","text-align:right;",4,"matCellDef"],["mat-header-row","",4,"matHeaderRowDef"],["mat-row","",4,"matRowDef","matRowDefColumns"],["mat-header-cell",""],["mat-cell",""],[1,"user-row-cell"],[1,"user-chip"],[1,"user-cell-name"],[1,"user-cell-email"],[1,"role-chip"],["mat-cell","",2,"text-align","right"],["mat-icon-button","","matTooltip","Edit role",3,"click"],[2,"font-size","16px"],["mat-icon-button","","color","warn","matTooltip","Remove user",3,"click"],["mat-header-row",""],["mat-row",""],["matColumnDef","name"],[1,"user-chip","zopa"],[1,"role-chip","zopa"],["mat-icon-button","","color","warn","matTooltip","Remove",3,"click"],[1,"modal-overlay",3,"click"],[1,"modal-card",3,"click"],[1,"modal-head"],[1,"modal-icon",2,"background","#f3e8ff"],[2,"color","#7c3aed"],[1,"modal-sub"],[2,"padding-top","20px"],[1,"modal-form",3,"formGroup"],["appearance","outline",1,"full-width"],["formControlName","user_id"],[3,"value"],["formControlName","role"],["value","zopa_buyer"],["value","zopa_approver_l1"],["value","zopa_approver_l2"],["value","zopa_approver_l3"],[2,"padding","0 20px 20px","display","flex","gap","8px","justify-content","flex-end"],["mat-button","",3,"click"],["mat-raised-button","","color","primary",3,"click","disabled"],["diameter","18"],[1,"modal-icon",2,"background","var(--brand-light)"],[2,"color","var(--brand)"],[1,"form-row"],["appearance","outline",2,"flex","1"],["matInput","","formControlName","name"],["value","client_admin"],["value","client_buyer"],["value","client_approver_l1"],["value","client_approver_l2"],["value","client_approver_l3"],["matInput","","formControlName","email","type","email"],["matInput","","formControlName","password","type","password"],[1,"save-error"],[1,"modal-icon",2,"background","#f0fdf4"],[2,"color","#16a34a"],["matInput","","formControlName","code"],["matInput","","formControlName","po_prefix"],["matInput","","formControlName","gstin",2,"text-transform","uppercase"],[2,"margin-bottom","12px","display","flex","align-items","center","gap","12px"],["mat-stroked-button","","type","button",3,"click"],[2,"font-size","12px","color","var(--text-3)"],[1,"internal-toggle-row"],[2,"font-size","13px","font-weight","600","color","var(--text-1)"],[2,"font-size","12px","color","var(--text-3)","margin-top","2px"],["formControlName","is_internal","color","primary"],[1,"modal-card",2,"width","380px",3,"click"],[1,"modal-icon",2,"background","#fff7ed"]],template:function(e,o){e&1&&(t(0,"div",2)(1,"div",3)(2,"div",4)(3,"button",5)(4,"mat-icon"),l(5,"arrow_back"),i()(),u(6,xt,1,0,"mat-spinner",6)(7,Dt,18,10,"div",7),i(),u(8,Mt,9,0,"div",8),i(),u(9,Tt,4,0,"div",9)(10,It,7,1,"div",10)(11,Yt,51,5),i(),u(12,ii,39,4,"div",11),u(13,li,50,5,"div",11),u(14,ci,54,6,"div",11),u(15,gi,35,5,"div",11)),e&2&&(d(6),h(o.loading()?6:o.client()?7:-1),d(2),h(o.client()?8:-1),d(),h(o.loading()?9:o.loadError()?10:o.client()?11:-1),d(3),h(o.showAssignDialog()?12:-1),d(),h(o.showCreateUserDialog()?13:-1),d(),h(o.showEditDialog()?14:-1),d(),h(o.showEditRoleDialog()?15:-1))},dependencies:[oe,Ee,we,be,Ce,xe,ke,ye,Ze,Le,qe,Ne,Ge,Ue,ue,ge,_e,Oe,Pe,it,He,Xe,Je,Qe,$e,Ke,We,Ye,et,tt,ze,Ie,De,Te,Me,Ae,Re,rt,lt,ot,st,Fe,Ve,Be,je,at,nt,pt,V],styles:[".page-wrapper[_ngcontent-%COMP%]{padding:28px}.page-header[_ngcontent-%COMP%]{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}.client-title-block[_ngcontent-%COMP%]{display:flex;align-items:center;gap:12px}.client-avatar-wrap[_ngcontent-%COMP%]{position:relative;flex-shrink:0}.client-avatar[_ngcontent-%COMP%]{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,var(--brand),var(--brand-hover));color:#fff;font-size:22px;font-weight:800;display:flex;align-items:center;justify-content:center}.client-logo[_ngcontent-%COMP%]{width:52px;height:52px;border-radius:12px;object-fit:contain;border:1px solid var(--border);background:#fff}.logo-upload-btn[_ngcontent-%COMP%]{position:absolute;bottom:-6px;right:-6px;width:22px!important;height:22px!important;background:#fff!important;border:1px solid var(--border)!important;border-radius:50%!important;box-shadow:0 1px 4px #00000026;display:flex!important;align-items:center;justify-content:center}h2[_ngcontent-%COMP%]{margin:0;font-size:20px;font-weight:700}.client-meta[_ngcontent-%COMP%]{display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap}.code-tag[_ngcontent-%COMP%]{background:#f1f5f9;color:var(--text-2);font-family:monospace;font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px}.gstin-tag[_ngcontent-%COMP%]{background:#eff6ff;color:#2563eb;font-family:monospace;font-size:11px;font-weight:600;padding:2px 8px;border-radius:5px}.raise-po-btn[_ngcontent-%COMP%]{height:40px!important;font-weight:700!important}.loading-state[_ngcontent-%COMP%]{display:flex;flex-direction:column;align-items:center;gap:16px;padding:80px;color:var(--text-3)}.error-card[_ngcontent-%COMP%]{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-3);text-align:center}.error-card[_ngcontent-%COMP%]   mat-icon[_ngcontent-%COMP%]{font-size:40px;width:40px;height:40px;color:#dc2626}.info-grid[_ngcontent-%COMP%]{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px}.info-chip[_ngcontent-%COMP%]{display:flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 14px;font-size:13px;color:var(--text-2)}.info-chip[_ngcontent-%COMP%]   mat-icon[_ngcontent-%COMP%]{font-size:15px;width:15px;height:15px;color:var(--brand)}.info-chip[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%]{color:var(--text-1)}.detail-grid[_ngcontent-%COMP%]{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:900px){.detail-grid[_ngcontent-%COMP%]{grid-template-columns:1fr}}.user-card[_ngcontent-%COMP%]   mat-card-header[_ngcontent-%COMP%]{display:flex;align-items:center;gap:0;padding:16px 20px 0!important}.user-row-cell[_ngcontent-%COMP%]{display:flex;align-items:center;gap:10px}.user-chip[_ngcontent-%COMP%]{width:30px;height:30px;border-radius:8px;background:var(--brand-light);color:var(--brand);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}.user-chip.zopa[_ngcontent-%COMP%]{background:#f3e8ff;color:#7c3aed}.user-cell-name[_ngcontent-%COMP%]{font-size:13px;font-weight:600;color:var(--text-1)}.user-cell-email[_ngcontent-%COMP%]{font-size:11px;color:var(--text-3)}.role-chip[_ngcontent-%COMP%]{display:inline-block;background:#f1f5f9;color:var(--text-2);font-size:11px;font-weight:600;padding:3px 9px;border-radius:6px}.role-chip.zopa[_ngcontent-%COMP%]{background:#f3e8ff;color:#7c3aed}.empty-panel[_ngcontent-%COMP%]{display:flex;flex-direction:column;align-items:center;gap:8px;padding:32px 24px;color:var(--text-3);text-align:center}.empty-panel[_ngcontent-%COMP%]   mat-icon[_ngcontent-%COMP%]{font-size:32px;width:32px;height:32px;color:var(--border)}.empty-panel[_ngcontent-%COMP%]   p[_ngcontent-%COMP%]{margin:0;font-size:13px}.full-width[_ngcontent-%COMP%]{width:100%}.modal-overlay[_ngcontent-%COMP%]{position:fixed;inset:0;background:#0f172a73;z-index:1000;display:flex;align-items:center;justify-content:center;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}.modal-card[_ngcontent-%COMP%]{width:500px;max-width:92vw}.modal-head[_ngcontent-%COMP%]{display:flex;align-items:center;gap:12px}.modal-icon[_ngcontent-%COMP%]{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}.modal-sub[_ngcontent-%COMP%]{margin:4px 0 0;font-size:12px;color:var(--text-3)}.modal-form[_ngcontent-%COMP%]{display:flex;flex-direction:column;gap:14px}.form-row[_ngcontent-%COMP%]{display:flex;gap:12px}.save-error[_ngcontent-%COMP%]{display:flex;align-items:center;gap:8px;background:#fff1f2;border:1px solid #fecdd3;color:#e11d48;padding:10px 14px;border-radius:8px;font-size:13px;margin-top:8px}.save-error[_ngcontent-%COMP%]   mat-icon[_ngcontent-%COMP%]{font-size:16px;width:16px;height:16px}.internal-toggle-row[_ngcontent-%COMP%]{display:flex;align-items:center;justify-content:space-between;background:#f8f9fa;border:1px solid var(--border);border-radius:8px;padding:12px 14px}"]})};export{_t as ClientDetailComponent};
