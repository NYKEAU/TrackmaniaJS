import * as THREE from "three";

export class Sphere {
  public mesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.x = -2;
    this.mesh.position.z = 2;
    scene.add(this.mesh);
  }

  animate() {
    this.mesh.rotation.y += 0.015;
    this.mesh.position.y = Math.abs(Math.sin(Date.now() * 0.002)) * 0.5;
  }
}
