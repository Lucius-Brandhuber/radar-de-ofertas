# Radar de Ofertas

Dashboard para **monitorar ofertas na Biblioteca de Anúncios do Meta**: registre quantos
anúncios cada oferta roda por dia e acompanhe a tendência — quem está **escalando** e quem
está **caindo**.

## Como usar

1. **Nova oferta** — cadastre nome, nicho, anunciante e cole o link da busca na Biblioteca
   (vira atalho de 1 clique para reconferir a contagem).
2. **Registro de hoje** — o ritual diário: abra a busca de cada oferta, leia o número de
   resultados, digite e salve tudo de uma vez. A variação vs. o dia anterior aparece ao vivo.
3. **Clique no card** — veja o gráfico completo, estatísticas (variação total, média/dia,
   pico) e o histórico editável.

## Recursos

- Sparkline e gráfico de linha em SVG puro (sem dependências).
- Tendência e **momentum** calculados automaticamente; ordena os vencedores no topo.
- KPIs de escalando / caindo / registros do dia e destaque da maior alta.
- Filtros por nicho e status, busca e ordenação.
- Backup por **exportar / importar JSON**.

## Técnico

Site estático — `index.html` + `styles.css` + `app.js`, sem build. Os dados ficam no
**localStorage** do navegador, com toda a leitura/escrita isolada no objeto `Store`
(`app.js`), o que facilita plugar um backend (ex.: Supabase) depois sem reescrever o resto.

> A contagem de anúncios é inserida manualmente: a Biblioteca de Anúncios não expõe esse
> número de forma automatizável (a API oficial cobre apenas anúncios políticos/sociais).
