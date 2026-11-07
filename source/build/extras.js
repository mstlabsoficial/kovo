function fiscalBar(){return `<div class="fiscal"><span><b>Datos fiscales</b>${esc(S.pro.name)} · NIF ${esc(S.pro.nif)} · ${esc(S.pro.addr)}</span>${S.role==='psicologa'?'<button class="btn sm" data-act="goFiscal">Editar</button>':''}</div>`}
async function pdfInv(i){
  const J=window.jspdf&&window.jspdf.jsPDF;
  if(!J){toast('El generador de PDF no se ha cargado. Revisa la conexión e inténtalo de nuevo');return}
  const doc=new J({unit:'mm',format:'a4'});const t=tot(i);const m=c=>(c/100).toFixed(2).replace('.',',')+' EUR';
  let y=22;doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text(`Factura ${i.num||'(borrador)'}`,20,y);
  doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text(`Fecha: ${fD(i.date)}`,190,y-6,{align:'right'});doc.text(`Vence: ${fD(i.due)}`,190,y,{align:'right'});
  y+=12;doc.setFont('helvetica','bold');doc.text('Emisor',20,y);doc.setFont('helvetica','normal');y+=5;
  [S.pro.name,'NIF '+S.pro.nif,S.pro.addr,'Colegiada '+S.pro.col].forEach(l=>{doc.text(String(l),20,y);y+=5});
  y+=4;doc.setFont('helvetica','bold');doc.text('Destinatario',20,y);doc.setFont('helvetica','normal');y+=5;
  [i.to.name,i.to.nif,i.to.addr].filter(Boolean).forEach(l=>{doc.text(String(l),20,y);y+=5});
  y+=8;doc.setFont('helvetica','bold');doc.text('Concepto',20,y);doc.text('Cant.',120,y,{align:'right'});doc.text('Precio',152,y,{align:'right'});doc.text('Importe',190,y,{align:'right'});y+=2;doc.line(20,y,190,y);y+=6;doc.setFont('helvetica','normal');
  i.lines.forEach(l=>{doc.text(String(l.desc).slice(0,62),20,y);doc.text(String(l.qty),120,y,{align:'right'});doc.text(m(l.price),152,y,{align:'right'});doc.text(m(Math.round(l.qty*l.price)),190,y,{align:'right'});y+=6});
  y+=2;doc.line(120,y,190,y);y+=6;
  [['Base imponible',t.base],['IVA',t.iva]].concat(i.ret?[[`Retención IRPF ${i.ret} %`,-t.ret]]:[]).forEach(([k,v])=>{doc.text(k,120,y);doc.text(m(v),190,y,{align:'right'});y+=6});
  doc.setFont('helvetica','bold');doc.text('Total',120,y);doc.text(m(t.total),190,y,{align:'right'});
  if(i.lines.some(l=>l.exempt)){y+=14;doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Operación exenta de IVA conforme al art. 20.Uno.3º de la Ley 37/1992.',20,y)}
  const fn=`factura-${String(i.num||'borrador').replace('/','-')}.pdf`;
  audit(`PDF de la factura ${i.num||'borrador'} exportado`);
  if(DL){try{await DL.save({filename:fn,data:doc.output('blob')});toast('PDF exportado');return}catch(e){if(e&&e.code==='declined')return}}
  toast('La descarga no está disponible en este visor');
}
