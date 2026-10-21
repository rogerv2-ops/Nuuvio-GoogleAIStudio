var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});class CoreEvents{eventos: any; listeners: any; constructor(){this.eventos=[];this.listeners=[];this.sembrarEventosIniciales()/* sin datos de ejemplo: los KPI se miden en la base */}static{__name(this,"CoreEvents")}emitir(payload){const nuevoEvento={id:`evt_${Date.now()}_${Math.random().toString(36).substring(2,8)}`,tipoEvento:payload.tipoEvento,fechaHora:new Date().toISOString(),actorTipo:payload.actorTipo,actorId:payload.actorId,distrito:payload.distrito||"Lima",provincia:payload.provincia||"Lima",origen:payload.origen,datos:payload.datos||{}};this.eventos.unshift(nuevoEvento);this.listeners.forEach(fn=>fn(nuevoEvento));this.persistir(nuevoEvento);return nuevoEvento}
  /**
   * Envia el evento al servidor para que quede PERSISTIDO.
   *
   * Antes los eventos se perdian al recargar la pagina (vivian en este
   * `Map` en memoria), y por eso el panel no tenia con que medir las visitas
   * a la landing ni las impresiones de las ofertas.
   *
   * Es "a fire y forget": si el servidor no esta o el evento no es de los
   * admitidos, no pasa nada. El evento sigue estando en memoria para los
   * listeners de la sesion.
   */
  persistir(evento){
    try{
      if(typeof fetch!=="function")return;
      const _cuerpo=JSON.stringify({tipoEvento:evento.tipoEvento,actorTipo:evento.actorTipo,actorId:evento.actorId,distrito:evento.distrito,provincia:evento.provincia,origen:evento.origen,datos:evento.datos});
      if(_cuerpo.length>4000)return;
      void fetch("/api/eventos",{method:"POST",headers:{"Content-Type":"application/json"},body:_cuerpo,keepalive:true}).catch(()=>{});
    }catch{}
  }consultar(filtros){let resultado=[...this.eventos];if(filtros?.tipoEvento){resultado=resultado.filter(e=>e.tipoEvento===filtros.tipoEvento)}if(filtros?.actorTipo){resultado=resultado.filter(e=>e.actorTipo===filtros.actorTipo)}if(filtros?.actorId){resultado=resultado.filter(e=>e.actorId===filtros.actorId)}if(filtros?.distrito){resultado=resultado.filter(e=>e.distrito?.toLowerCase()===filtros.distrito?.toLowerCase())}if(filtros?.limite){resultado=resultado.slice(0,filtros.limite)}return resultado}contar(tipoEvento,filtroDistrito){return this.consultar({tipoEvento,distrito:filtroDistrito}).length}suscribir(listener){this.listeners.push(listener);return()=>{this.listeners=this.listeners.filter(l=>l!==listener)}}sembrarEventosIniciales(){const fechaBase=new Date(Date.now()-3*24*60*60*1e3);const eventosSemilla=[];;eventosSemilla.forEach((ev,idx)=>{this.eventos.push({id:`evt_init_${idx+1}`,tipoEvento:ev.tipoEvento,fechaHora:new Date(fechaBase.getTime()+idx*36e5*8).toISOString(),actorTipo:ev.actorTipo,actorId:ev.actorId,distrito:ev.distrito||"Lima",provincia:"Lima",origen:ev.origen,datos:ev.datos||{}})})}}const coreEvents=new CoreEvents;export{coreEvents};
