export type Product={id:string;name:string;description:string;price:number;available:boolean;kind:'fresh'|'frozen'};
export type Settings={headline:string;intro:string;story:string;hours:string;location:string};
export const initialSettings:Settings={headline:'South American\nsurf fuel.',intro:'Empanadas made from scratch. Rooted in South America. At home on the West Coast.',story:'PUNA began at the Ucluelet farmers market, bringing the food José grew up with in Lima to his new community. After studying and working in engineering in Canada, he followed another passion: sharing food. Surf brought him to Ucluelet. The chance to cook for the community made him stay.\n\nPuna is the name of the Andean highlands — and the name he first gave his dog. A dog, a bicycle and a journey became the beginning of something bigger.',hours:'Opening hours to be confirmed.',location:'Ucluelet & Tofino · Vancouver Island. Exact pickup location to be confirmed.'};
export const initialProducts:Product[]=[
{id:'eggplant',name:'Roasted Eggplant',description:'Caramelized onions, roasted peppers, eggplant, carrots and potatoes. Slowly cooked in red wine, herbs and spices, with sultana raisins and hemp hearts.',price:800,available:true,kind:'fresh'},
{id:'chicken',name:'Ají Chicken',description:'Our spicy chicken. Caramelized onions, chicken and potatoes, cooked in cream, walnuts and spices. Finished with white sesame seeds.',price:800,available:true,kind:'fresh'},
{id:'carne',name:'Carne',description:'Ground beef and pork with spices, caramelized onions, roasted garlic, potatoes and sweet peas. Black and white sesame seeds on top.',price:800,available:true,kind:'fresh'},
{id:'ham',name:'Ham & Cheese',description:'Smoked ham, mozzarella and mature cheddar with Dijon mayonnaise and potatoes. Finished with oregano.',price:800,available:true,kind:'fresh'},
{id:'strudel',name:'Puna Strüdl',description:'Apples browned in butter and spices, with walnuts, raisins and quinoa. Finished with poppy seeds.',price:800,available:true,kind:'fresh'},
...['Roasted Eggplant','Chicken','Carne'].map((name,i)=>({id:'frozen-'+i,name,description:'Four raw-frozen empanadas. Bake-at-home range in development.',price:2500,available:false,kind:'frozen' as const}))];
export const slots=['12:00–12:30','12:30–13:00','13:00–13:30'];
export const statuses=['New','Preparing','Ready','Collected','Cancelled'] as const;
export type Order={id:string;customer:string;slot:string;items:{id:string;name:string;quantity:number;price:number}[];total:number;status:typeof statuses[number];created_at:string};
export const money=(v:number)=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(v/100);
