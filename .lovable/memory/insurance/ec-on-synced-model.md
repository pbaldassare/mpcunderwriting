---
name: E/C su modello sincronizzato
description: Le pagine Estratto Conto (Clienti/Compagnie/Produttori) leggono da `titoli` ma i numeri riflettono il nuovo modello via trigger di sync
type: feature
---

Le pagine `ECClientiContabPage`, `ECClientiStoricoPage`, `ECProduttoriContabPage`, `ECCompagniaContabPage` interrogano `titoli` filtrando su `data_messa_cassa`. Il trigger `tg_quietanza_sync_to_titoli` (Fase 1 split Polizza/Quietanza) propaga ogni operazione fatta sulle `quietanze` (messa a cassa, incasso, importo_incassato) verso la riga `titoli` equivalente. Quindi i totali E/C sono già corretti sul nuovo modello senza dover riscrivere le query — non riscriverle "per coerenza", romperebbe la denormalizzazione cliente/compagnia/ramo senza alcun beneficio numerico.
