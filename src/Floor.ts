import * as THREE from "three";

export class Floor {
  public mesh!: THREE.Mesh;
  public terrain: THREE.Group;
  private size: number = 100;
  private segments: number = 128;

  constructor(scene: THREE.Scene) {
    // Création du groupe de terrain
    this.terrain = new THREE.Group();
    scene.add(this.terrain);

    // Création du sol principal
    this.createMainFloor(scene);

    // Ajout des éléments du circuit
    this.createTrackElements();
  }

  private createMainFloor(scene: THREE.Scene): void {
    // Géométrie plus grande pour le circuit
    const geometry = new THREE.PlaneGeometry(
      this.size,
      this.size,
      this.segments,
      this.segments
    );

    // Création d'une texture de circuit
    const textureLoader = new THREE.TextureLoader();
    const floorTexture = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2,
    });

    // Création du mesh et configuration
    this.mesh = new THREE.Mesh(geometry, floorTexture);
    this.mesh.receiveShadow = true;
    this.mesh.position.y = -0.5;
    this.mesh.rotation.x = -Math.PI / 2;

    // Ajouter à la scène
    scene.add(this.mesh);
    this.terrain.add(this.mesh);

    // Créer une bordure pour le circuit
    this.createBorder(scene);
  }

  private createBorder(scene: THREE.Scene): void {
    // Créer une bordure autour du circuit principal
    const borderWidth = this.size + 2;
    const borderGeometry = new THREE.BoxGeometry(borderWidth, 1, borderWidth);
    const borderMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 1.0,
    });

    // Créer le mesh de la bordure
    const borderMesh = new THREE.Mesh(borderGeometry, borderMaterial);
    borderMesh.position.y = -1.0;
    borderMesh.receiveShadow = true;

    // Ajouter à la scène
    scene.add(borderMesh);
    this.terrain.add(borderMesh);
  }

  private createTrackElements(): void {
    // Ajout de rampes et d'obstacles
    this.addRamp(10, 0, 10, 5, 2, Math.PI / 8);
    this.addRamp(-15, 0, -15, 8, 3, -Math.PI / 6);

    // Ajout de quelques virages surélevés
    this.addElevatedTurn(20, 0, 5, 10, 1.5, Math.PI / 4);
    this.addElevatedTurn(-20, 0, -5, 12, 2, -Math.PI / 4);

    // Créations de bornes et repères visuels
    this.addTrackmarkers();
  }

  private addRamp(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    rotation: number
  ): void {
    // Création d'une rampe
    const rampGeometry = new THREE.BoxGeometry(width, 0.5, 4);
    const rampMaterial = new THREE.MeshStandardMaterial({
      color: 0x3366cc,
      roughness: 0.5,
    });

    const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp.position.set(x, y, z);
    ramp.rotation.x = rotation;
    ramp.position.y = height / 2;
    ramp.castShadow = true;
    ramp.receiveShadow = true;

    this.terrain.add(ramp);
  }

  private addElevatedTurn(
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number,
    rotation: number
  ): void {
    // Création d'un virage surélevé
    const turnGeometry = new THREE.CylinderGeometry(
      radius,
      radius,
      0.5,
      32,
      1,
      false,
      0,
      Math.PI / 2
    );
    const turnMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc3366,
      roughness: 0.6,
    });

    const turn = new THREE.Mesh(turnGeometry, turnMaterial);
    turn.position.set(x, y + height / 2, z);
    turn.rotation.y = rotation;
    turn.castShadow = true;
    turn.receiveShadow = true;

    this.terrain.add(turn);
  }

  private addTrackmarkers(): void {
    // Ajouter des repères visuels sur le circuit
    for (let i = -40; i <= 40; i += 20) {
      this.addMarker(i, 0, 40, 0xff0000);
      this.addMarker(i, 0, -40, 0x0000ff);
      this.addMarker(40, 0, i, 0xffff00);
      this.addMarker(-40, 0, i, 0x00ff00);
    }
  }

  private addMarker(x: number, y: number, z: number, color: number): void {
    const markerGeometry = new THREE.BoxGeometry(1, 2, 1);
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.5,
    });

    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(x, y, z);
    marker.castShadow = true;
    marker.receiveShadow = true;

    this.terrain.add(marker);
  }

  public animate(): void {
    // Si besoin d'animation du sol (mouvement d'éléments, etc.)
  }

  public getHeight(x: number, z: number): number {
    // Méthode pour obtenir la hauteur du terrain à une position donnée
    // À implémenter pour une détection de collision avec le terrain
    return -0.5; // Hauteur par défaut
  }
}
