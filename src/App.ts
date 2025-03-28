import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GUI } from "lil-gui";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { Car } from "./Car";
import { CarWheels } from "./CarWheels";

export class App {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private gui: GUI;
  private car!: Car;
  private envMap: THREE.Texture | null = null;
  private ground!: THREE.Mesh;
  private debugMode: boolean = false;
  private clock: THREE.Clock;
  private velocityArrow: THREE.ArrowHelper | null = null;
  private directionArrow: THREE.ArrowHelper | null = null;
  private carWheels: CarWheels;

  // Paramètres de la caméra TPS (Third Person)
  private tpsEnabled: boolean = true;
  private tpsCameraOffset = new THREE.Vector3(0, 3, -10);
  private tpsCameraLookOffset = new THREE.Vector3(0, 1, 5);
  private tpsCameraLerp: number = 0.05;
  private tpsCameraTarget = new THREE.Vector3();
  private tpsCameraPosition = new THREE.Vector3();

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.gui = new GUI();
    this.clock = new THREE.Clock();
    this.car = new Car(this.scene);

    // Créer l'instance de CarWheels après la voiture
    this.carWheels = new CarWheels(this.scene, this.car);

    this.init();
    this.setupSimpleGUI();
    this.loadHDRBackground("studio.hdr");
    this.animate();
  }

  public init() {
    // Setup renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document.body.appendChild(this.renderer.domElement);

    // Setup camera
    this.camera.position.set(0, 5, 15);
    this.camera.lookAt(0, 0, 0);

    // Setup controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.1; // Empêcher de passer sous le circuit
    this.controls.enabled = !this.tpsEnabled; // Désactiver les contrôles si TPS activé par défaut

    // Setup basic lighting
    this.setupLighting();

    // Create ground plane
    this.createGround();

    // Create debug helpers
    this.createDebugHelpers();

    // Setup window resize handler
    window.addEventListener("resize", () => this.onWindowResize());

    // Setup car reset
    document.addEventListener("keydown", (event) => {
      if (event.key === "r") {
        this.car.reset();
      }
      // Basculer entre mode TPS et mode libre avec la touche C
      else if (event.key === "c" || event.key === "C") {
        this.tpsEnabled = !this.tpsEnabled;
        this.controls.enabled = !this.tpsEnabled;
      }
    });
  }

  private createDebugHelpers(): void {
    // Créer les flèches de visualisation de mouvement
    // Ces flèches seront mises à jour dans la boucle d'animation
    const origin = new THREE.Vector3(0, 0, 0);
    const dir = new THREE.Vector3(0, 0, 1);

    // Flèche de direction (verte)
    this.directionArrow = new THREE.ArrowHelper(dir, origin, 2, 0x00ff00);

    // Flèche de vitesse (rouge)
    this.velocityArrow = new THREE.ArrowHelper(dir, origin, 2, 0xff0000);

    // Ajouter les flèches à la scène seulement si le mode debug est activé
    if (this.debugMode) {
      this.scene.add(this.directionArrow);
      this.scene.add(this.velocityArrow);
    }
  }

  private createGround(): void {
    // Grand plane pour le sol
    const planeGeometry = new THREE.PlaneGeometry(200, 200);
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.8,
      metalness: 0.2,
    });

    this.ground = new THREE.Mesh(planeGeometry, planeMaterial);
    this.ground.rotation.x = -Math.PI / 2; // Rotation pour l'horizontalité
    this.ground.position.y = 0;
    this.ground.receiveShadow = true;

    // Ajout d'une grille pour faciliter la visualisation
    const gridHelper = new THREE.GridHelper(200, 50, 0x000000, 0x666666);
    gridHelper.position.y = 0.01; // Légèrement au-dessus du sol pour éviter le z-fighting

    // Ajout des objets à la scène
    this.scene.add(this.ground);
    this.scene.add(gridHelper);

    // Ajout d'un axe des repères
    if (this.debugMode) {
      const axesHelper = new THREE.AxesHelper(5);
      this.scene.add(axesHelper);
    }
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.bias = -0.0001;
    this.scene.add(directionalLight);
  }

  private onWindowResize(): void {
    // Mettre à jour la caméra et le renderer lors du redimensionnement
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private setupSimpleGUI(): void {
    // Exposition du renderer
    this.gui
      .add(this.renderer, "toneMappingExposure", 0, 2, 0.01)
      .name("Exposure");

    // TPS Camera
    const tpsCameraFolder = this.gui.addFolder("TPS Camera");
    tpsCameraFolder
      .add(this as any, "tpsEnabled")
      .name("Enable TPS")
      .onChange((value: boolean) => {
        // Activer/désactiver les contrôles orbitaux en fonction de la vue
        this.controls.enabled = !value;
      });

    tpsCameraFolder.add(this.tpsCameraOffset, "y", 1, 10, 0.5).name("Height");
    tpsCameraFolder
      .add(this.tpsCameraOffset, "z", -20, -5, 0.5)
      .name("Distance");
    tpsCameraFolder
      .add(this as any, "tpsCameraLerp", 0.01, 0.2, 0.01)
      .name("Smoothing");
    tpsCameraFolder
      .add(this.tpsCameraLookOffset, "y", 0, 5, 0.5)
      .name("Look Height");
    tpsCameraFolder
      .add(this.tpsCameraLookOffset, "z", 0, 15, 0.5)
      .name("Look Ahead");

    // Paramètres de la caméra
    const cameraFolder = this.gui.addFolder("Free Camera");
    cameraFolder.add(this.camera.position, "x", -100, 100, 1).name("X");
    cameraFolder.add(this.camera.position, "y", 1, 100, 1).name("Y");
    cameraFolder.add(this.camera.position, "z", -100, 100, 1).name("Z");

    // Debug mode
    const debugFolder = this.gui.addFolder("Debug");
    debugFolder
      .add(this as any, "debugMode")
      .name("Debug Mode")
      .onChange((value: boolean) => {
        // Mise à jour des aides visuelles en fonction du mode debug
        const axesHelper = this.scene.getObjectByName("axesHelper");
        if (value) {
          if (!axesHelper) {
            const newAxesHelper = new THREE.AxesHelper(5);
            newAxesHelper.name = "axesHelper";
            this.scene.add(newAxesHelper);
          }

          // Ajouter les flèches de visualisation si elles existent
          if (
            this.velocityArrow &&
            !this.scene.children.includes(this.velocityArrow)
          ) {
            this.scene.add(this.velocityArrow);
          }
          if (
            this.directionArrow &&
            !this.scene.children.includes(this.directionArrow)
          ) {
            this.scene.add(this.directionArrow);
          }
        } else {
          if (axesHelper) {
            this.scene.remove(axesHelper);
          }

          // Supprimer les flèches de visualisation
          if (
            this.velocityArrow &&
            this.scene.children.includes(this.velocityArrow)
          ) {
            this.scene.remove(this.velocityArrow);
          }
          if (
            this.directionArrow &&
            this.scene.children.includes(this.directionArrow)
          ) {
            this.scene.remove(this.directionArrow);
          }
        }
      });

    // Contrôles de la voiture - seront ajoutés après chargement
    this.setupCarControls();

    // Controls info
    const infoFolder = this.gui.addFolder("Controls");
    infoFolder.add({ info: "Z / Up: Forward" }, "info");
    infoFolder.add({ info: "S / Down: Backward" }, "info");
    infoFolder.add({ info: "Q / Left: Turn Left" }, "info");
    infoFolder.add({ info: "D / Right: Turn Right" }, "info");
    infoFolder.add({ info: "Space: Brake" }, "info");
    infoFolder.add({ info: "C: Toggle Camera Mode" }, "info");
    infoFolder.add({ info: "R: Reset Car Position" }, "info");
  }

  private setupCarControls(): void {
    // Les contrôles seront ajoutés une fois que le modèle sera chargé
    const checkInterval = setInterval(() => {
      if (this.car.model) {
        clearInterval(checkInterval);

        // Paramètres physiques de la voiture
        const physicsFolder = this.gui.addFolder("Car Physics");

        // Obtenir les paramètres de physique depuis la voiture
        const physics = this.car.getPhysicsParams();

        // Paramètres de base
        physicsFolder
          .add(physics, "acceleration", 0.01, 0.1, 0.005)
          .name("Acceleration");
        physicsFolder.add(physics, "maxSpeed", 0.5, 2, 0.1).name("Max Speed");
        physicsFolder
          .add(physics, "friction", 0.001, 0.01, 0.001)
          .name("Friction");
        physicsFolder.add(physics, "mass", 0.5, 2, 0.1).name("Mass");
        physicsFolder.add(physics, "gravity", 0, 0.05, 0.001).name("Gravity");

        // Comportement de conduite
        const drivingFolder = this.gui.addFolder("Driving Behavior");
        drivingFolder
          .add(physics, "steeringFactor", 0.1, 2, 0.05)
          .name("Steering Response");
        drivingFolder
          .add(physics, "driftFactor", 0, 0.2, 0.01)
          .name("Drift Amount");
        drivingFolder.add(physics, "traction", 0.5, 1, 0.01).name("Traction");
        drivingFolder
          .add(physics, "inertiaFactor", 0.05, 0.5, 0.01)
          .name("Inertia");
        drivingFolder
          .add(physics, "movementSmoothing", 0.1, 0.9, 0.05)
          .name("Movement Smoothing");
        drivingFolder
          .add(physics, "ackermannFactor", 0.1, 1, 0.05)
          .name("Low Speed Turn Factor");

        // Paramètres des roues
        const wheelFolder = this.gui.addFolder("Wheels");
        const wheelParams = this.carWheels.getWheelParams();
        wheelFolder
          .add(wheelParams, "wheelSpeedMultiplier", 10, 100, 1)
          .name("Rotation Speed");
        wheelFolder
          .add(wheelParams, "wheelInertia", 0.01, 0.5, 0.01)
          .name("Wheel Inertia");
        wheelFolder
          .add(wheelParams, "wheelRadius", 0.1, 0.5, 0.01)
          .name("Wheel Radius");
        wheelFolder
          .add(wheelParams, "maxSteeringAngle", 0.1, 0.8, 0.05)
          .name("Steering Angle");
        wheelFolder
          .add(wheelParams, "steeringSpeed", 0.05, 0.5, 0.05)
          .name("Steering Response");

        // Ajout d'un moniteur de vitesse avec une échelle plus adaptée aux nouvelles vitesses
        const speedDisplay = { speed: "0.000", kph: "0" };
        physicsFolder.add(speedDisplay, "speed").name("Speed (units)").listen();
        physicsFolder.add(speedDisplay, "kph").name("Speed (km/h)").listen();

        // Mise à jour de l'affichage de la vitesse
        setInterval(() => {
          const velocity = this.car.getVelocity();
          const speedValue = velocity.length();
          speedDisplay.speed = speedValue.toFixed(3);

          // Conversion arbitraire en km/h pour un affichage plus intuitif (20 unités = ~100km/h)
          speedDisplay.kph = Math.round((speedValue * 100) / 2).toString();
        }, 100);
      }
    }, 100);
  }

  private loadHDRBackground(filename: string): void {
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load(`src/textures/studio.hdr`, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.background = texture;
      this.scene.environment = texture;
      this.envMap = texture;

      // Update materials to use the environment map
      this.scene.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.MeshStandardMaterial
        ) {
          child.material.envMap = texture;
          child.material.needsUpdate = true;
        }
      });
    });
  }

  private updateDebugHelpers(): void {
    if (!this.debugMode || !this.car.model) return;

    // Obtenir les informations de la voiture
    const position = this.car.getPosition();
    const velocity = this.car.getVelocity();

    if (!position) return;

    // Hauteur des flèches au-dessus de la voiture
    const arrowHeight = 1.5;

    // Mettre à jour la flèche de direction
    if (this.directionArrow) {
      const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.car.model.rotation.y
      );

      this.directionArrow.position.copy(position);
      this.directionArrow.position.y += arrowHeight;
      this.directionArrow.setDirection(dir.normalize());
      this.directionArrow.setLength(2);
    }

    // Mettre à jour la flèche de vitesse
    if (this.velocityArrow) {
      const vel = velocity.clone();
      const length = vel.length() * 10; // Échelle pour meilleure visibilité

      this.velocityArrow.position.copy(position);
      this.velocityArrow.position.y += arrowHeight + 0.5; // Un peu plus haut que la flèche de direction

      if (length > 0.01) {
        this.velocityArrow.setDirection(vel.normalize());
        this.velocityArrow.setLength(length);
        this.velocityArrow.visible = true;
      } else {
        // Cacher la flèche si la vitesse est trop faible
        this.velocityArrow.visible = false;
      }
    }
  }

  private updateTpsCamera(): void {
    if (!this.tpsEnabled || !this.car.model) return;

    const carPosition = this.car.getPosition();
    if (!carPosition) return;

    // Récupérer la vitesse et la direction de la voiture
    const velocity = this.car.getVelocity();
    const speed = velocity.length();
    const carDirection = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.car.model.rotation.y
    );
    const movingForward = velocity.dot(carDirection) > 0;

    // Calculer la position idéale de la caméra en fonction de la rotation de la voiture
    // et de l'offset de la caméra TPS
    const idealCameraPosition = new THREE.Vector3();
    const carRotation = this.car.model.rotation.y;

    // Calculer l'offset de base de la caméra
    let cameraOffset = this.tpsCameraOffset.clone();

    // Ajuster la distance de la caméra en fonction de la vitesse et de la direction
    if (speed > 0.05) {
      // Seuil minimal pour éviter les micro-mouvements
      // Facteur de zoom basé sur la vitesse (limité)
      const baseZoomFactor = Math.min(1.2, 1 + speed * 0.2);

      // En marche arrière, réduire l'effet de zoom
      const directionFactor = movingForward ? 1 : 0.7;

      // Appliquer le zoom uniquement sur l'axe Z (distance)
      cameraOffset.z *= baseZoomFactor * directionFactor;
    }

    // Calculer l'offset rotatif avec la nouvelle distance
    this.tpsCameraPosition
      .copy(cameraOffset)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), carRotation)
      .add(carPosition);

    // Calculer la position cible de la caméra (vers où elle regarde)
    this.tpsCameraTarget
      .copy(this.tpsCameraLookOffset)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), carRotation)
      .add(carPosition);

    // Interpolation linéaire (LERP) pour un mouvement plus fluide
    // Augmenter le lissage à basse vitesse pour éviter les à-coups
    const lerpFactor = this.tpsCameraLerp * (1 + (1 - Math.min(1, speed * 2)));
    this.camera.position.lerp(this.tpsCameraPosition, lerpFactor);

    // Faire regarder la caméra vers la voiture (ou légèrement devant)
    this.camera.lookAt(this.tpsCameraTarget);
  }

  public animate() {
    requestAnimationFrame(() => this.animate());

    // Get delta time for smooth animation
    const delta = this.clock.getDelta();

    // Animate car
    this.car.animate(delta);

    // Mettre à jour les roues
    this.carWheels.update(delta);

    // Update TPS camera if enabled
    this.updateTpsCamera();

    // Update debug helpers
    this.updateDebugHelpers();

    // Update orbit controls only if TPS mode is not enabled
    if (!this.tpsEnabled) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }
}
