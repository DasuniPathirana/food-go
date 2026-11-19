/**
 * Food Go real-time window and trim decals.
 * A single batched mesh follows source-map polygon wall edges. Decorative
 * windows do not purport to reproduce surveyed architecture.
 */
import { MercatorCoordinate } from "maplibre-gl";
import {
  BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute,
  Mesh, MeshBasicMaterial, RepeatWrapping, SRGBColorSpace, type Scene,
} from "three";
import type { FacadeObject } from "./game-world-facades";

function windowAtlas(): CanvasTexture {
  const c=document.createElement("canvas");
  c.width=128; c.height=128;
  const ctx=c.getContext("2d");
  if (ctx) {
    ctx.clearRect(0,0,128,128);
    // Subtle architectural cornice and stone pilasters.
    ctx.fillStyle="rgba(239,226,199,.58)";
    ctx.fillRect(0,0,128,5);
    ctx.fillRect(0,122,128,6);
    ctx.fillStyle="rgba(232,217,190,.35)";
    ctx.fillRect(2,0,7,128);
    ctx.fillRect(119,0,7,128);
    // Slightly inset window with deep frames. Warm and cool variation appears
    // within the same building rather than random flashing every frame.
    ctx.fillStyle="rgba(46,70,77,.84)";
    ctx.fillRect(22,17,84,93);
    ctx.fillStyle="rgba(29,73,75,.84)";
    ctx.fillRect(26,20,78,86);
    const sky=ctx.createLinearGradient(28,24,100,103);
    sky.addColorStop(0,"rgba(136,179,179,.83)");
    sky.addColorStop(.46,"rgba(58,106,113,.87)");
    sky.addColorStop(1,"rgba(24,54,68,.88)");
    ctx.fillStyle=sky;ctx.fillRect(30,25,69,75);
    // Warm interior accents suggest life without fake claims about occupancy.
    ctx.fillStyle="rgba(252,210,127,.62)";
    ctx.fillRect(31,25,12,74);
    ctx.fillStyle="rgba(255,237,181,.35)";
    ctx.fillRect(34,27,5,65);
    ctx.strokeStyle="rgba(230,219,187,.83)";
    ctx.lineWidth=5;ctx.strokeRect(24,19,78,88);
    ctx.fillStyle="rgba(235,227,203,.8)";
    ctx.fillRect(63,19,5,88);
    ctx.fillRect(24,62,78,5);
    ctx.fillStyle="rgba(73,108,108,.53)";
    ctx.fillRect(24,104,78,4);
    // Short sill and tiny canopy soften the old flat single-color extrusion.
    ctx.fillStyle="rgba(232,201,143,.72)";
    ctx.fillRect(16,109,95,6);
  }
  const tex=new CanvasTexture(c);
  tex.colorSpace=SRGBColorSpace;
  tex.wrapS=RepeatWrapping;
  tex.wrapT=RepeatWrapping;
  tex.anisotropy=4;
  tex.needsUpdate=true;
  return tex;
}

/** One batch for all visible facade strips. Call once per scenery rebuild. */
export function addFacadeDressing(
  scene: Scene, facades: readonly FacadeObject[],
  origin: MercatorCoordinate, unit: number,
): number {
  if (!facades.length) return 0;
  const positions: number[]=[];
  const uvs: number[]=[];
  let strips=0;
  for (const facade of facades) {
    if (facade.ring.length<3) continue;
    const world=facade.ring.map(p=>{
      const c=MercatorCoordinate.fromLngLat({lng:p[0],lat:p[1]},0);
      return {x:(c.x-origin.x)/unit,z:(c.y-origin.y)/unit};
    });
    let area=0;
    for(let i=0;i<world.length;i++){
      const a=world[i],b=world[(i+1)%world.length];
      area+=a.x*b.z-b.x*a.z;
    }
    const outward=area>=0?1:-1;
    const base=Math.max(0,facade.base+.55);
    const high=facade.height-.6;
    if (high-base<2.4) continue;
    for(let i=0;i<world.length;i++){
      const a=world[i],b=world[(i+1)%world.length];
      const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
      if (len<3.1 || len>165) continue;
      // Normal points outward from the ring; a 0.19m shift avoids z-fighting
      // while preserving the true outline of the existing extrusion.
      const nx=outward*dz/len*.19,nz=-outward*dx/len*.19;
      const aX=a.x+nx,aZ=a.z+nz,bX=b.x+nx,bZ=b.z+nz;
      const u=len/4.15,v=(high-base)/3.65;
      positions.push(
        aX,base,aZ, bX,base,bZ, bX,high,bZ,
        aX,base,aZ, bX,high,bZ, aX,high,aZ,
      );
      uvs.push(0,0,u,0,u,v, 0,0,u,v,0,v);
      strips++;
    }
  }
  if (!strips) return 0;
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(positions,3));
  geometry.setAttribute("uv",new Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();
  const material=new MeshBasicMaterial({
    map:windowAtlas(),side:DoubleSide,transparent:true,opacity:.94,
    depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1,
  });
  const mesh=new Mesh(geometry,material);
  mesh.name="food-go-geographic-facade-batch";
  mesh.frustumCulled=false; // Individual facades span the local map area.
  scene.add(mesh);
  return strips;
}
