import * as THREE from "three";

export class Ring {
  public mesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.RingGeometry(1, 2, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.x = 2;
    this.mesh.position.z = 2;
    this.mesh.rotation.x = -Math.PI / 2;
    scene.add(this.mesh);
  }

  animate() {
    this.mesh.rotation.z += 0.02;
    this.mesh.rotation.x = Math.sin(Date.now() * 0.0005) * 0.3;
    this.mesh.position.x = 2 + Math.sin(Date.now() * 0.001) * 0.5;
    this.mesh.position.z = 2 + Math.cos(Date.now() * 0.001) * 0.5;
  }
}
