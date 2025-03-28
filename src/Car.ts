import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class Car {
  private scene: THREE.Scene;
  public model: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private animations: THREE.AnimationClip[] = [];

  // Physique du véhicule (utilisation des vecteurs THREE.js pour optimisation)
  private velocity = new THREE.Vector3(0, 0, 0);
  private direction = new THREE.Vector3(0, 0, 1);

  // Paramètres ajustés pour une conduite plus réaliste
  private acceleration = 0.03; // Accélération augmentée
  private deceleration = 0.97; // Décélération plus douce
  private maxSpeed = 1.2; // Vitesse maximale augmentée
  private baseRotationSpeed = 0.02; // Vitesse de rotation de base réduite
  private mass = 1.2; // Augmentation légère de la masse
  private friction = 0.005; // Réduction de la friction pour glisser plus
  private drag = 0.0002; // Réduction du drag aérodynamique
  private gravity = 0.01; // Maintenu pour la stabilité
  private groundLevel = 0; // Niveau du sol
  private lastDeltaTime = 0.016; // Mémoriser le dernier deltaTime pour stabilisation

  // Paramètres de conduite avancés
  private steeringFactor = 0.85; // Influence de la vitesse sur la direction (plus basse = moins d'influence)
  private steeringMax = 0.8; // Limite du facteur de direction
  private driftFactor = 0.03; // Force de dérapage
  private traction = 0.9; // Traction (adhérence des pneus)
  private inertiaFactor = 0.25; // Facteur d'inertie (résistance au changement de direction)
  private movementSmoothing = 0.8; // Facteur de lissage des mouvements (0-1, plus élevé = plus lisse)
  private ackermannFactor = 0.5; // Facteur de l'effet Ackermann pour les virages à basse vitesse (0-1)

  // Interface pour les paramètres de physique
  private physicsParams = {
    acceleration: 0.03,
    maxSpeed: 1.2,
    friction: 0.005,
    mass: 1.2,
    gravity: 0.01,
    steeringFactor: 0.85,
    driftFactor: 0.03,
    traction: 0.9,
    inertiaFactor: 0.25,
  };

  // Vecteurs réutilisables pour optimisation
  private tempVector = new THREE.Vector3();
  private tempVector2 = new THREE.Vector3();
  private tempVector3 = new THREE.Vector3(); // Vecteur supplémentaire pour les calculs
  private up = new THREE.Vector3(0, 1, 0);
  private forward = new THREE.Vector3(0, 0, 1);
  private right = new THREE.Vector3(1, 0, 0);

  // État des touches
  private keys = {
    forward: false, // Z ou flèche haut
    backward: false, // S ou flèche bas
    left: false, // Q ou flèche gauche
    right: false, // D ou flèche droite,
    brake: false, // Espace
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.loadModel();
    this.setupKeyboardControls();
  }

  // Méthode pour exposer les paramètres de physique à l'interface GUI
  public getPhysicsParams(): any {
    // Création d'un proxy pour mettre à jour les valeurs réelles
    const self = this;
    return {
      get acceleration() {
        return self.acceleration;
      },
      set acceleration(value: number) {
        self.acceleration = value;
        self.physicsParams.acceleration = value;
      },

      get maxSpeed() {
        return self.maxSpeed;
      },
      set maxSpeed(value: number) {
        self.maxSpeed = value;
        self.physicsParams.maxSpeed = value;
      },

      get friction() {
        return self.friction;
      },
      set friction(value: number) {
        self.friction = value;
        self.physicsParams.friction = value;
      },

      get mass() {
        return self.mass;
      },
      set mass(value: number) {
        self.mass = value;
        self.physicsParams.mass = value;
      },

      get gravity() {
        return self.gravity;
      },
      set gravity(value: number) {
        self.gravity = value;
        self.physicsParams.gravity = value;
      },

      get steeringFactor() {
        return self.steeringFactor;
      },
      set steeringFactor(value: number) {
        self.steeringFactor = value;
        self.physicsParams.steeringFactor = value;
      },

      get driftFactor() {
        return self.driftFactor;
      },
      set driftFactor(value: number) {
        self.driftFactor = value;
        self.physicsParams.driftFactor = value;
      },

      get traction() {
        return self.traction;
      },
      set traction(value: number) {
        self.traction = value;
        self.physicsParams.traction = value;
      },

      get inertiaFactor() {
        return self.inertiaFactor;
      },
      set inertiaFactor(value: number) {
        self.inertiaFactor = value;
        self.physicsParams.inertiaFactor = value;
      },

      get movementSmoothing() {
        return self.movementSmoothing;
      },
      set movementSmoothing(value: number) {
        self.movementSmoothing = value;
      },

      get ackermannFactor() {
        return self.ackermannFactor;
      },
      set ackermannFactor(value: number) {
        self.ackermannFactor = value;
      },
    };
  }

  private loadModel(): void {
    const loader = new GLTFLoader();

    loader.load(
      "/models/trackmania2020_revisited.glb",
      (gltf) => {
        // Extraction du modèle
        this.model = gltf.scene;

        // Extraction des animations (si existantes)
        this.animations = gltf.animations;
        if (this.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.model);
        }

        // Configuration des ombres et des matériaux
        this.model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Position et échelle initiales - s'assurer que la voiture est bien au sol
        this.model.position.set(0, this.groundLevel, 0);
        this.model.scale.set(1, 1, 1);

        // Ajout à la scène
        this.scene.add(this.model);

        console.log("Car model loaded:", this.model);
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      (error) => {
        console.error("An error happened while loading the model:", error);
      }
    );
  }

  private setupKeyboardControls(): void {
    document.addEventListener("keydown", (event) => {
      switch (event.key.toLowerCase()) {
        case "z":
        case "arrowup":
          this.keys.forward = true;
          break;
        case "s":
        case "arrowdown":
          this.keys.backward = true;
          break;
        case "q":
        case "arrowleft":
          this.keys.left = true;
          break;
        case "d":
        case "arrowright":
          this.keys.right = true;
          break;
        case " ": // Espace
          this.keys.brake = true;
          break;
      }
    });

    document.addEventListener("keyup", (event) => {
      switch (event.key.toLowerCase()) {
        case "z":
        case "arrowup":
          this.keys.forward = false;
          break;
        case "s":
        case "arrowdown":
          this.keys.backward = false;
          break;
        case "q":
        case "arrowleft":
          this.keys.left = false;
          break;
        case "d":
        case "arrowright":
          this.keys.right = false;
          break;
        case " ": // Espace
          this.keys.brake = false;
          break;
      }
    });
  }

  /**
   * Gère la rotation du véhicule en fonction de la vitesse et de la direction
   * avec un comportement réaliste à basse vitesse
   * @param rotationAmount Quantité de rotation souhaitée
   * @param deltaTime Temps écoulé depuis la dernière frame
   * @param absSpeed Vitesse absolue du véhicule
   * @param velocityDirection Direction de la vitesse (-1 à 1)
   */
  private applyRotation(
    rotationAmount: number,
    deltaTime: number,
    absSpeed: number,
    velocityDirection: number
  ): void {
    if (!this.model) return;

    // 1. Facteur de vitesse pour l'effet d'Ackermann (réduction de l'effet pivot)
    // Plus la vitesse est faible, plus l'effet d'Ackermann est important
    // Utiliser le paramètre ackermannFactor pour contrôler l'intensité de l'effet
    const speedFactor = Math.min(1, absSpeed * 5 + 0.2);
    const ackermannEffect =
      this.ackermannFactor * (1 - speedFactor) + speedFactor;

    // 2. Calcul du rayon de braquage (plus grand = virage plus large)
    // La distance entre l'essieu avant et arrière (approximativement)
    const wheelBase = 1.8;

    // Angle de braquage effectif (réduit à basse vitesse pour éviter le pivot central)
    const effectiveSteeringAngle = rotationAmount * ackermannEffect;

    // 3. Calcul de la rotation en tenant compte de l'empattement et de la vitesse
    let rotationAngle = effectiveSteeringAngle;

    // À basse vitesse, réduire davantage la rotation pour éviter l'effet de téléportation
    if (absSpeed < 0.3) {
      // Plus la vitesse est faible, plus la rotation est progressive
      const lowSpeedFactor = Math.max(0.1, absSpeed / 0.3);
      rotationAngle *= lowSpeedFactor;
    }

    // 4. Appliquer la rotation au modèle
    this.model.rotation.y += rotationAngle;

    // 5. Ajuster légèrement la position pour simuler un mouvement d'arc plutôt qu'un pivot
    // Cela simule le fait que l'arrière du véhicule suit un arc plus large
    if (Math.abs(rotationAmount) > 0.001 && absSpeed > 0.05) {
      // Vecteur perpendiculaire à la direction pour simuler la force centrifuge
      const perpDirection = new THREE.Vector3()
        .copy(this.tempVector3)
        .multiplyScalar(Math.sign(rotationAmount));

      // L'effet est plus prononcé à vitesse élevée et dans les virages serrés
      const centrifugalForce =
        Math.abs(rotationAmount) *
        absSpeed *
        0.02 * // Force de base
        (1 - ackermannEffect); // Plus fort à basse vitesse

      // Ajuster la position pour simuler le mouvement d'arc
      this.model.position.add(
        perpDirection.multiplyScalar(centrifugalForce * deltaTime)
      );
    }
  }

  public animate(deltaTime: number = 0.016): void {
    if (!this.model) return;

    // Mise à jour de l'animation avec le delta time
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    // Stabiliser le deltaTime pour éviter les variations brusques
    // qui peuvent causer des à-coups lorsque le framerate fluctue
    this.lastDeltaTime = deltaTime * 0.2 + this.lastDeltaTime * 0.8;
    deltaTime = this.lastDeltaTime;

    // Mise à l'échelle du temps pour adapter les forces
    const scaledDelta = deltaTime * 60; // Normalisation pour 60 FPS

    // --- 1. CALCUL DES DIRECTIONS ---

    // Direction actuelle du modèle (avant)
    this.direction
      .copy(this.forward)
      .applyAxisAngle(this.up, this.model.rotation.y);

    // Direction perpendiculaire (droite) pour les forces latérales
    this.tempVector3
      .copy(this.right)
      .applyAxisAngle(this.up, this.model.rotation.y);

    // --- 2. VITESSE ET FORCES ---

    // Vitesse courante
    const speed = this.velocity.length();
    const absSpeed = Math.abs(speed);

    // Calcul de l'orientation de la vitesse par rapport à la direction
    // 1 = en avant, -1 = en arrière, 0 = perpendiculaire
    const velocityDirection =
      speed > 0.001 ? this.velocity.clone().normalize().dot(this.direction) : 0;

    // Force de propulsion (direction x accélération)
    const accelerationForce = new THREE.Vector3();

    // --- 3. ACCÉLÉRATION/FREINAGE ---

    // Facteur d'accélération ajusté au deltaTime avec lissage supplémentaire
    const scaledAcceleration = this.acceleration * scaledDelta;

    // Accélération uniquement si on n'est pas en train de freiner
    if (this.keys.forward && !this.keys.brake) {
      // Plus la vitesse est élevée, plus l'accélération diminue (simulation de résistance de l'air)
      const accelerationMultiplier = Math.max(
        0.2,
        1 - absSpeed / (this.maxSpeed * 1.2)
      );
      accelerationForce
        .copy(this.direction)
        .multiplyScalar(scaledAcceleration * accelerationMultiplier);
    }

    // Marche arrière avec lissage amélioré pour éviter les à-coups
    if (this.keys.backward && !this.keys.brake) {
      // Amélioration de la marche arrière pour plus de fluidité
      // Utilisation d'une courbe d'accélération plus progressive
      const reverseMultiplier = Math.max(
        0.2,
        1 - absSpeed / (this.maxSpeed * 0.7)
      );

      // Transition plus douce entre marche avant et marche arrière
      const reverseTransitionFactor = velocityDirection < 0 ? 1.0 : 0.5;

      accelerationForce
        .copy(this.direction)
        .multiplyScalar(
          -scaledAcceleration *
            0.7 *
            reverseMultiplier *
            reverseTransitionFactor
        );
    }

    // Freinage (ralentissement plus rapide dans la direction actuelle de déplacement)
    if (this.keys.brake && speed > 0.001) {
      // Direction opposée à la vitesse actuelle
      accelerationForce
        .copy(this.velocity)
        .normalize()
        .multiplyScalar(-scaledAcceleration * 3);
    }

    // Application de la force à la vitesse selon la masse avec lissage
    accelerationForce.divideScalar(this.mass);

    // Lissage de l'accélération pour réduire les à-coups
    const smoothingFactor = this.movementSmoothing * (1 + absSpeed * 0.5);
    this.tempVector.copy(accelerationForce).multiplyScalar(1 - smoothingFactor);
    accelerationForce.multiplyScalar(smoothingFactor);
    accelerationForce.add(this.tempVector);

    this.velocity.add(accelerationForce);

    // --- 4. DIRECTION ET DÉRAPAGE ---

    // Calcul de la vitesse de rotation basée sur la vitesse actuelle
    // Plus on va vite, moins on tourne rapidement (relation inversement proportionnelle mais plafonnée)
    let currentRotationSpeed = this.baseRotationSpeed;

    // Ajustement de la direction en fonction de la vitesse
    if (absSpeed > 0.05) {
      // Calculer le facteur de direction (diminue avec la vitesse, mais limité)
      const steeringCoefficient = Math.max(
        this.steeringMax,
        this.steeringFactor / (absSpeed * 0.5 + 0.1)
      );

      // Appliquer ce facteur à la vitesse de rotation de base
      currentRotationSpeed *= steeringCoefficient;

      // À grande vitesse, la rotation est plus rapide en marche avant
      if (velocityDirection < 0) {
        // En marche arrière
        currentRotationSpeed *= 0.7; // Plus difficile de tourner en marche arrière
      }
    } else {
      // À très faible vitesse, la rotation est moins influencée
      currentRotationSpeed *= 1.5; // Faciliter les manœuvres à l'arrêt
    }

    // Application de la rotation selon les commandes
    let rotationAmount = 0;
    if (this.keys.left) rotationAmount += 1;
    if (this.keys.right) rotationAmount -= 1;

    // Appliquer la rotation au modèle avec le scaling du delta
    if (rotationAmount !== 0) {
      // *** INERTIE: La rotation prend du temps à s'appliquer en fonction de la vitesse ***
      // Calculer la rotation souhaitée
      const targetRotation =
        rotationAmount * currentRotationSpeed * scaledDelta;

      // Appliquer l'inertie - plus on va vite, plus l'inertie est élevée
      const inertiaMultiplier = this.inertiaFactor * (1 + absSpeed * 2);

      // Inverser la direction de braquage en marche arrière pour un comportement plus intuitif
      // comme dans les jeux vidéo (S+Q = reculer vers la gauche)
      let smoothedRotation;
      if (velocityDirection < 0 && Math.abs(velocityDirection) > 0.5) {
        // En marche arrière franche, inverser la direction de rotation
        smoothedRotation = -targetRotation / (1 + inertiaMultiplier);
      } else {
        // En marche avant ou à faible vitesse, comportement normal
        smoothedRotation = targetRotation / (1 + inertiaMultiplier);
      }

      // Plutôt que d'appliquer directement la rotation, utiliser notre méthode améliorée
      this.applyRotation(
        smoothedRotation,
        deltaTime,
        absSpeed,
        velocityDirection
      );

      // Effet de dérapage: ajouter une force latérale lorsqu'on tourne à haute vitesse
      if (absSpeed > 0.3) {
        // Augmenter l'effet de dérapage avec la vitesse et l'angle de braquage
        const driftMultiplier = absSpeed > 0.7 ? 1.5 : 1.0;
        const driftAmount =
          this.driftFactor *
          absSpeed *
          Math.abs(rotationAmount) *
          driftMultiplier *
          scaledDelta;

        const lateralForce = this.tempVector3
          .clone()
          .multiplyScalar(rotationAmount * driftAmount);

        this.velocity.add(lateralForce);
      }
    }

    // --- 5. TRACTION ET ADHÉRENCE ---

    // Décomposer la vitesse en composantes avant/arrière et latérales
    const forwardVelocity = this.direction
      .clone()
      .multiplyScalar(this.direction.dot(this.velocity));
    const lateralVelocity = this.velocity.clone().sub(forwardVelocity);

    // Appliquer la traction (les roues adhèrent mieux dans l'axe de déplacement)
    // Plus le facteur est bas, plus la voiture dérape

    // Ajuster la traction en fonction de la vitesse - plus difficile de maintenir la traction à haute vitesse
    const speedAdjustedTraction = Math.max(
      0.5,
      this.traction - absSpeed * 0.15
    );
    lateralVelocity.multiplyScalar(
      Math.pow(speedAdjustedTraction, scaledDelta)
    );

    // Recomposer la vitesse finale
    this.velocity.copy(forwardVelocity).add(lateralVelocity);

    // --- 6. FORCES EXTÉRIEURES ET LIMITATIONS ---

    // Résistance aérodynamique (proportionnelle au carré de la vitesse)
    // À haute vitesse, la résistance aérodynamique augmente significativement
    const quadraticDrag = this.drag * (1 + absSpeed * 0.5);
    const dragForce = this.velocity
      .clone()
      .normalize()
      .multiplyScalar(-quadraticDrag * this.velocity.lengthSq() * scaledDelta);

    // Application de la friction seulement si on est en mouvement
    if (speed > 0.001) {
      // Friction augmentée dans les virages pour simuler l'usure des pneus
      const turningFriction =
        this.friction * (1 + Math.abs(rotationAmount) * absSpeed * 0.2);
      const frictionForce = this.velocity
        .clone()
        .normalize()
        .multiplyScalar(-turningFriction * scaledDelta);

      // Appliquer ces forces à la vitesse
      this.velocity.add(dragForce.divideScalar(this.mass));
      this.velocity.add(frictionForce.divideScalar(this.mass));
    } else if (speed <= 0.001 && !this.keys.forward && !this.keys.backward) {
      // Arrêt complet en dessous d'un certain seuil si pas d'accélération
      this.velocity.set(0, 0, 0);
    }

    // Limitation de la vitesse maximale
    if (speed > this.maxSpeed) {
      this.velocity.normalize().multiplyScalar(this.maxSpeed);
    }

    // --- 7. PHYSIQUE VERTICALE ---

    // Gravité et contact avec le sol
    this.applyGravity(deltaTime);

    // --- 8. MISE À JOUR DE LA POSITION ET INCLINAISON DU VÉHICULE ---

    // Déplacement avec lissage supplémentaire
    if (speed > 0) {
      // Appliquer un lissage supplémentaire aux mouvements à faible vitesse
      // pour réduire les à-coups, particulièrement en marche arrière
      const movement = this.velocity.clone().multiplyScalar(scaledDelta);

      // Si on est en marche arrière, appliquer un lissage supplémentaire
      if (velocityDirection < 0) {
        // Accumuler le mouvement pour le lisser davantage
        this.tempVector2.copy(movement).multiplyScalar(0.8);
        movement.multiplyScalar(0.2);
        movement.add(this.tempVector2);
      }

      this.model.position.add(movement);
    }

    // Effet visuel d'inclinaison en courbe
    if (this.model) {
      // Inclinaison avant/arrière (pitch) basée sur l'accélération et la vitesse
      let targetPitch = 0;

      if (this.keys.forward) {
        // Inclinaison arrière (nose up) lors de l'accélération, plus prononcée au démarrage
        targetPitch = -0.03 * (1 - absSpeed / this.maxSpeed);
      } else if (this.keys.backward) {
        // Inclinaison avant (nose down) en marche arrière
        targetPitch = 0.03 * (1 - absSpeed / (this.maxSpeed * 0.7));
      } else if (this.keys.brake && speed > 0.1) {
        // Inclinaison avant lors du freinage, proportionnelle à la vitesse
        targetPitch = 0.05 * Math.min(1, absSpeed / this.maxSpeed);
      }

      // Inclinaison latérale (roll) basée sur la direction et la vitesse
      const lateralSpeed = this.tempVector3.dot(this.velocity);
      // Plus d'inclinaison dans les virages à haute vitesse (comme une vraie voiture)
      const rollFactor = 0.3 * (1 + absSpeed);
      const targetRoll = -lateralSpeed * rollFactor;

      // Application progressive des inclinaisons
      const tiltSpeed = 0.1 * scaledDelta * 3; // Vitesse d'application des inclinaisons
      this.model.rotation.x +=
        (targetPitch - this.model.rotation.x) * tiltSpeed;
      this.model.rotation.z += (targetRoll - this.model.rotation.z) * tiltSpeed;
    }

    // Debug: uniquement pour les vitesses significatives
    if (speed > 0.05) {
      console.log(
        "Speed:",
        speed.toFixed(3),
        "Direction:",
        velocityDirection.toFixed(2)
      );
    }
  }

  // Applique la gravité pour maintenir la voiture au sol
  private applyGravity(deltaTime: number): void {
    if (!this.model) return;

    const scaledGravity = this.gravity * deltaTime * 60;

    // Si la voiture est en dessous du niveau du sol, la remonter
    if (this.model.position.y < this.groundLevel) {
      this.model.position.y = this.groundLevel;
      // Annuler tout mouvement vertical
      this.velocity.y = 0;
    } else if (this.model.position.y > this.groundLevel) {
      // Appliquer la gravité
      this.velocity.y -= scaledGravity;
    }
  }

  // Méthodes publiques pour réinitialiser la voiture
  public reset(): void {
    if (this.model) {
      this.model.position.set(0, this.groundLevel, 0);
      this.model.rotation.set(0, 0, 0);
      this.velocity.set(0, 0, 0);
    }
  }

  // Méthode pour obtenir la position actuelle de la voiture
  public getPosition(): THREE.Vector3 | null {
    return this.model ? this.model.position : null;
  }

  // Méthode pour obtenir la vitesse actuelle de la voiture
  public getVelocity(): THREE.Vector3 {
    return this.velocity.clone();
  }

  // Méthode pour obtenir la rotation actuelle de la voiture
  public getRotation(): number | null {
    return this.model ? this.model.rotation.y : null;
  }

  // Méthode pour obtenir les inputs actuels
  public getInputs(): any {
    return { ...this.keys };
  }

  // Méthode pour détecter les collisions (à implémenter plus tard)
  public detectCollisions(obstacles: THREE.Object3D[]): boolean {
    // Implémentation basique à développer plus tard
    return false;
  }
}
