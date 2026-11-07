    <section class="panel"><header><h2>Datos personales</h2><div class="actions"><button class="btn sm" data-act="editPatient" data-id="${p.id}">Editar</button></div></header><dl class="dl">
      <dt>Nombre</dt><dd><b>${esc(p.name)}</b></dd><dt>Código</dt><dd>${pc(p)}</dd><dt>Email</dt><dd><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></dd><dt>Teléfono</dt><dd><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></dd>
      <dt>NIF / CIF</dt><dd>${esc(p.billing.nif||'—')}</dd><dt>Dirección</dt><dd>${esc(p.billing.addr||'—')}</dd>
      <dt>Alta</dt><dd>${fD(p.alta)}</dd><dt>Servicio habitual</dt><dd>${esc(SV(p.service).name)}</dd><dt>Modalidad</dt><dd>${esc(p.modal)}</dd>
      <dt>Facturar a</dt><dd>${p.billing.type==='empresa'?`${esc(p.billing.name)}<br><span class="muted">retención IRPF ${p.billing.ret}%</span>`:'El propio paciente'}</dd>
      <dt>Recordatorios</dt><dd>${p.reminders?'Activados':'Desactivados'}</dd><dt>Consentimiento</dt><dd>${p.consent?`Subido el ${fD(p.consent.at)}`:`<a href="#" data-act="ptab" data-t="docs" style="color:var(--warn);font-weight:700">Pendiente de subir</a>`}</dd></dl>
      <p class="muted small" style="margin:14px 0 0">Estos datos solo los ven psicóloga y recepción. En calendario, informes y contabilidad el paciente aparece únicamente por su código.</p></section></div>`;
