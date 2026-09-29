-- Template email predefinito per invio documenti da tab Documenti.
-- Idempotente: non duplica se esiste già un template con lo stesso nome.

INSERT INTO public.template_categorie (nome, descrizione)
SELECT 'Invio documenti', 'Email con allegato documento da portafoglio / quietanze'
WHERE NOT EXISTS (
  SELECT 1 FROM public.template_categorie WHERE lower(nome) = 'invio documenti'
);

INSERT INTO public.template_email (nome, oggetto, corpo, categoria_id, attivo)
SELECT
  'Invio documento allegato',
  'Documento: {{documento}} — Polizza {{polizza}}',
  '<p>Gentile {{cliente}},</p>
<p>in allegato troverete il documento <strong>{{documento}}</strong> relativo alla polizza <strong>{{polizza}}</strong>.</p>
<p>Cordiali saluti,<br/>Consulbrokers</p>',
  c.id,
  true
FROM public.template_categorie c
WHERE lower(c.nome) = 'invio documenti'
  AND NOT EXISTS (
    SELECT 1 FROM public.template_email t WHERE t.nome = 'Invio documento allegato'
  )
LIMIT 1;
