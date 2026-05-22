
import { useParams } from "react-router-dom";

const products = [
  { id: 1, name: "Grilled Chicken", price: 45, image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092" },
  { id: 2, name: "Tilapia & Banku", price: 60, image: "https://images.unsplash.com/photo-1553621042-f6e147245754" },
  { id: 3, name: "Kebab", price: 20, image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d" }
];

export default function StorePage(){
  const { companyId } = useParams();

  return (
    <div style={{padding:20}}>
      <h1>Grill Store: {companyId}</h1>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20}}>
        {products.map(p => (
          <div key={p.id} style={{border:'1px solid #ddd', padding:10}}>
            <img src={p.image} style={{width:'100%', height:200, objectFit:'cover'}} />
            <h3>{p.name}</h3>
            <p>GHS {p.price}</p>
            <button>Add to Cart</button>
          </div>
        ))}
      </div>
    </div>
  )
}
