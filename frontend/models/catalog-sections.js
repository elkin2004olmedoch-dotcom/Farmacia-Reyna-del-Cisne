(function(global){
  'use strict';
  const sections=[
    {id:'bienestar',nombre:'Bienestar',descripcion:'Vitaminas, suplementos y nutrición para tu bienestar.',imagen:'assets/images/producto-catalogo-glucerna-vainilla-en-polvo-400-g-91cf656e.webp'},
    {id:'cuidado',nombre:'Cuidado personal',descripcion:'Esenciales para la higiene y el cuidado diario.',imagen:'assets/images/producto-catalogo-nivea-creme-250ml-cbef06b1.webp'},
    {id:'bebe',nombre:'Mamá y bebé',descripcion:'Cuidado e higiene para madres y bebés.',imagen:'assets/images/producto-catalogo-similac-mama-vainilla-en-polvo-400-g-37ac6d2f.webp'},
    {id:'medicamentos',nombre:'Medicamentos',descripcion:'Referencias farmacéuticas y atención profesional.',imagen:'assets/images/producto-catalogo-dulcolax-comprimidos-5-mg-10-unidades-cd9e969e.webp'},
    {id:'salud-digestiva',nombre:'Salud digestiva',descripcion:'Productos para el cuidado digestivo.',imagen:'assets/images/producto-catalogo-enterogermina-2000-millones-10-frascos-de-5-ml-d40e4a80.webp'},
    {id:'dermocosmetica',nombre:'Dermocosmética',descripcion:'Limpieza, hidratación y cuidado de la piel.',imagen:'assets/images/producto-catalogo-leti-at4-crema-corporal-200-ml-93a2a636.webp'},
    {id:'proteccion-solar',nombre:'Protección solar',descripcion:'Protectores solares para rostro y cuerpo.',imagen:'assets/images/producto-catalogo-nivea-sun-proteccion-hidratacion-fps-50-7fbbff88.webp'},
    {id:'higiene-bucal',nombre:'Higiene bucal',descripcion:'Cuidado de dientes, encías y prótesis dentales.',imagen:'assets/images/producto-catalogo-colgate-triple-accion-menta-original-150-ml-d68fe7ac.webp'},
    {id:'cuidado-capilar',nombre:'Cuidado capilar',descripcion:'Limpieza y cuidado del cabello y cuero cabelludo.',imagen:'assets/images/producto-catalogo-pilexil-champu-anticaida-300-ml-a13410a6.webp'},
    {id:'higiene-intima',nombre:'Higiene íntima',descripcion:'Productos de higiene y cuidado íntimo.',imagen:'assets/images/producto-catalogo-nosotras-sensiti-v-jabon-intimo-200-ml-3bfc4961.webp'},
    {id:'salud-sexual',nombre:'Salud sexual',descripcion:'Protección y cuidado para la salud sexual.',imagen:'assets/images/producto-catalogo-durex-clasico-3-unidades-68b949bc.webp'},
    {id:'primeros-auxilios',nombre:'Primeros auxilios',descripcion:'Gasas, vendas y esenciales para el botiquín.',imagen:'assets/images/producto-catalogo-nexcare-micropore-530-p1-cinta-blanca-1-pulgada-9-47510ba3.webp'},
    {id:'equipos-medicos',nombre:'Equipos médicos',descripcion:'Equipos para medición y cuidado en casa.',imagen:'assets/images/producto-catalogo-omron-hem-7120-la-monitor-de-presion-arterial-de-e8872437.webp'},
    {id:'adulto-mayor',nombre:'Adulto mayor',descripcion:'Higiene y cuidado para personas mayores.',imagen:'assets/images/producto-catalogo-tena-slip-clasico-9-unidades-aa97e93a.webp'},
    {id:'cuidado-ocular-nasal',nombre:'Cuidado ocular y nasal',descripcion:'Higiene y cuidado de ojos y nariz.',imagen:'assets/images/producto-catalogo-bizare-solucion-nasal-hipertonica-125-ml-1bc15978.webp'},
    {id:'ortopedia',nombre:'Ortopedia',descripcion:'Soportes y accesorios de apoyo corporal.',imagen:'assets/images/producto-catalogo-futuro-tira-ajustable-para-rotula-09189psr-ab1cfd73.webp'},
  ];
  const ids=sections.map(section=>section.id);
  const api={sections,ids,find:id=>sections.find(section=>section.id===id)};
  (global.Farmacia ||= {}).catalogSections=api;
  if(typeof module!=='undefined' && module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
