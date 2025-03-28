import * as THREE from "three";
import { Car } from "./Car";

export class CarWheels {
  private scene: THREE.Scene;
  private car: Car;

  // Références aux roues
  private wheels: {
    frontLeft: THREE.Object3D | null;
    frontRight: THREE.Object3D | null;
    backLeft: THREE.Object3D | null;
    backRight: THREE.Object3D | null;
  } = {
    frontLeft: null,
    frontRight: null,
    backLeft: null,
    backRight: null,
  };

  // Conteneurs de roues pour la rotation horizontale (virages)
  private wheelContainers: {
    frontLeft: THREE.Object3D | null;
    frontRight: THREE.Object3D | null;
  } = {
    frontLeft: null,
    frontRight: null,
  };

  // Paramètres des roues
  private wheelRadius = 0.25; // Rayon approximatif des roues
  private wheelRotationSpeed = 0; // Vitesse de rotation actuelle des roues
  private targetWheelRotationSpeed = 0; // Vitesse cible pour l'inertie
  private wheelInertia = 0.15; // Facteur d'inertie des roues (plus petit = plus réactif)
  private wheelSpeedMultiplier = 30; // Multiplicateur pour rendre la rotation plus visible
  private wheelRotations = {
    frontLeft: 0,
    frontRight: 0,
    backLeft: 0,
    backRight: 0,
  }; // Mémoriser les rotations plutôt que d'utiliser rotateX

  // Paramètres pour la rotation lors des virages
  private maxSteeringAngle = 0.4; // Angle maximal de braquage en radians (environ 23 degrés)
  private currentSteeringAngle = 0; // Angle actuel
  private steeringSpeed = 0.1; // Vitesse de rotation du volant

  // Paramètres exposés pour l'interface GUI
  private wheelParams = {
    wheelRadius: 0.25,
    wheelInertia: 0.15,
    wheelSpeedMultiplier: 30,
    maxSteeringAngle: 0.4, // Ajout du paramètre de braquage dans le GUI
    steeringSpeed: 0.1, // Vitesse de réponse du volant
  };

  constructor(scene: THREE.Scene, car: Car) {
    this.scene = scene;
    this.car = car;
    this.findAndSetupWheels();
  }

  /**
   * Recherche les roues dans le modèle et les configure
   */
  private findAndSetupWheels(): void {
    // On attend que le modèle de la voiture soit chargé
    const checkInterval = setInterval(() => {
      if (this.car.model) {
        clearInterval(checkInterval);
        console.log("Recherche des roues dans le modèle...");

        // Afficher la hiérarchie complète du modèle pour debug
        console.log("Exploration de la hiérarchie du modèle:");
        this.car.model.traverse((child) => {
          console.log(`Objet trouvé: "${child.name}", type: ${child.type}`);
        });

        // Parcourir tous les objets du modèle pour trouver les roues
        this.car.model.traverse((child) => {
          // Normalisation des noms pour faciliter la recherche (insensible à la casse)
          const name = child.name.toLowerCase();

          if (
            name.includes("rouag") ||
            name === "roueag" ||
            name === "roue avant gauche"
          ) {
            this.wheels.frontLeft = child;
            console.log("Roue Avant Gauche trouvée:", child.name);
          } else if (
            name.includes("rouad") ||
            name === "rouead" ||
            name === "roue avant droite"
          ) {
            this.wheels.frontRight = child;
            console.log("Roue Avant Droite trouvée:", child.name);
          } else if (
            name.includes("routedg") ||
            name.includes("rouedg") ||
            name === "roue arrière gauche"
          ) {
            this.wheels.backLeft = child;
            console.log("Roue Arrière Gauche trouvée:", child.name);
          } else if (
            name.includes("rouedd") ||
            name === "routedd" ||
            name === "roue arrière droite"
          ) {
            this.wheels.backRight = child;
            console.log("Roue Arrière Droite trouvée:", child.name);
          }
        });

        // Vérifier que toutes les roues ont été trouvées
        const allWheelsFound = Object.values(this.wheels).every(
          (wheel) => wheel !== null
        );
        if (allWheelsFound) {
          console.log("Toutes les roues ont été trouvées et configurées!");

          // Créer les conteneurs pour les roues avant
          this.createWheelContainers();
        } else {
          console.warn("Certaines roues n'ont pas été trouvées:", this.wheels);

          // On essaie une dernière approche pour les roues manquantes en cherchant par type d'objet
          if (!this.wheels.backLeft) {
            console.log(
              "Tentative de recherche de la roue arrière gauche par type d'objet..."
            );
            // Chercher un objet qui ressemble à une roue (mesh cylindrique ou Mesh)
            this.car.model.traverse((child) => {
              if (child instanceof THREE.Mesh && !this.wheels.backLeft) {
                if (
                  child.name.toLowerCase().includes("roue") ||
                  child.name.toLowerCase().includes("wheel") ||
                  child.geometry instanceof THREE.CylinderGeometry
                ) {
                  // Vérifier que cet objet n'est pas déjà une des roues trouvées
                  if (
                    child !== this.wheels.frontLeft &&
                    child !== this.wheels.frontRight &&
                    child !== this.wheels.backRight
                  ) {
                    this.wheels.backLeft = child;
                    console.log(
                      "Roue Arrière Gauche trouvée par détection d'objet:",
                      child.name
                    );
                  }
                }
              }
            });
          }
        }
      }
    }, 100);
  }

  /**
   * Crée des conteneurs pour les roues avant afin de séparer
   * la rotation horizontale (direction) de la rotation d'avancement
   */
  private createWheelContainers(): void {
    if (!this.car.model) return;
    if (!this.wheels.frontLeft || !this.wheels.frontRight) return;

    // Récupérer les positions et rotations d'origine des roues
    const frontLeftPos = this.wheels.frontLeft.position.clone();
    const frontRightPos = this.wheels.frontRight.position.clone();
    const frontLeftRot = this.wheels.frontLeft.rotation.clone();
    const frontRightRot = this.wheels.frontRight.rotation.clone();

    // Créer le conteneur pour la roue avant gauche
    this.wheelContainers.frontLeft = new THREE.Object3D();
    this.wheelContainers.frontLeft.name = "WheelContainer_FrontLeft";
    this.wheelContainers.frontLeft.position.copy(frontLeftPos);
    this.wheelContainers.frontLeft.rotation.y = frontLeftRot.y;

    // Réinitialiser la rotation Y de la roue puisque le conteneur la gérera
    this.wheels.frontLeft.rotation.y = 0;

    // Créer le conteneur pour la roue avant droite
    this.wheelContainers.frontRight = new THREE.Object3D();
    this.wheelContainers.frontRight.name = "WheelContainer_FrontRight";
    this.wheelContainers.frontRight.position.copy(frontRightPos);
    this.wheelContainers.frontRight.rotation.y = frontRightRot.y;

    // Réinitialiser la rotation Y de la roue puisque le conteneur la gérera
    this.wheels.frontRight.rotation.y = 0;

    // Conserver la hiérarchie originale en remplaçant les roues par les conteneurs
    const frontLeftParent = this.wheels.frontLeft.parent;
    const frontRightParent = this.wheels.frontRight.parent;

    if (frontLeftParent) {
      // Détacher la roue de son parent original
      this.wheels.frontLeft.position.set(0, 0, 0); // Position relative au conteneur
      frontLeftParent.remove(this.wheels.frontLeft);

      // Ajouter le conteneur au parent original
      frontLeftParent.add(this.wheelContainers.frontLeft);

      // Ajouter la roue au conteneur
      this.wheelContainers.frontLeft.add(this.wheels.frontLeft);
    }

    if (frontRightParent) {
      // Détacher la roue de son parent original
      this.wheels.frontRight.position.set(0, 0, 0); // Position relative au conteneur
      frontRightParent.remove(this.wheels.frontRight);

      // Ajouter le conteneur au parent original
      frontRightParent.add(this.wheelContainers.frontRight);

      // Ajouter la roue au conteneur
      this.wheelContainers.frontRight.add(this.wheels.frontRight);
    }

    console.log("Conteneurs de roues avant créés avec succès!");
  }

  /**
   * Met à jour la rotation des roues en fonction de la vitesse
   */
  public update(deltaTime: number): void {
    // Vérifier que toutes les roues sont disponibles
    if (!this.areWheelsReady()) {
      return;
    }

    // Récupérer les informations de la voiture
    const velocity = this.car.getVelocity();
    const inputs = this.car.getInputs();
    const direction = this.car.getRotation() || 0;

    // Calculer la vitesse et la direction de déplacement
    const speed = velocity.length();
    const carDirection = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      direction
    );
    const movingForward = velocity.dot(carDirection) > 0;

    // Calculer la vitesse de rotation CIBLE des roues en fonction de la vitesse du véhicule
    if (Math.abs(speed) < 0.001) {
      this.targetWheelRotationSpeed = 0;
    } else {
      // Vitesse linéaire → vitesse angulaire (radians par seconde)
      // Formule: v = ω * r → ω = v / r
      const rawRotationSpeed = speed / this.wheelRadius;
      // Augmenter le multiplicateur pour une meilleure visibilité et réduire les accoups
      this.targetWheelRotationSpeed =
        rawRotationSpeed * this.wheelSpeedMultiplier;
    }

    // Appliquer l'inertie à la rotation des roues avec un lissage accru
    // Une valeur plus faible d'inertie réduit les à-coups
    const lerpFactor = 1.0 - Math.pow(this.wheelInertia, deltaTime * 60); // Augmenté de 30 à 60 pour plus de réactivité
    this.wheelRotationSpeed +=
      (this.targetWheelRotationSpeed - this.wheelRotationSpeed) * lerpFactor;

    // Appliquer la rotation sur toutes les roues
    // Note: Un angle delta plus petit à chaque frame réduit les mouvements saccadés
    const wheelDeltaRotation = this.wheelRotationSpeed * deltaTime;

    // Le sens de rotation dépend de la direction de déplacement
    const rotationAmount = movingForward
      ? wheelDeltaRotation
      : -wheelDeltaRotation;

    // Utiliser une rotation continue et accumulée plutôt que des appels répétés à rotateX
    // Cela évite les problèmes de précision qui peuvent causer des à-coups
    this.applyWheelRotations(rotationAmount);

    // Gérer la rotation horizontale des roues lors du braquage
    this.updateSteering(inputs, deltaTime, movingForward);

    // Debug: uniquement pour les vitesses significatives
    if (Math.abs(speed) > 0.05) {
      console.log(
        "Speed:",
        speed.toFixed(3),
        "Wheels rotation:",
        this.wheelRotationSpeed.toFixed(3),
        "Target rotation:",
        this.targetWheelRotationSpeed.toFixed(3)
      );
    }
  }

  /**
   * Applique une rotation à toutes les roues en utilisant une méthode plus fluide
   * qui accumule les rotations au lieu d'utiliser rotateX
   */
  private applyWheelRotations(angle: number): void {
    // Accumule les rotations pour chaque roue
    this.wheelRotations.frontLeft += angle;
    this.wheelRotations.frontRight += angle;
    this.wheelRotations.backLeft += angle;
    this.wheelRotations.backRight += angle;

    // Applique directement les rotations absolues (plus précis que les rotations relatives)
    if (this.wheels.frontLeft) {
      this.wheels.frontLeft.rotation.x = this.wheelRotations.frontLeft;
    }

    if (this.wheels.frontRight) {
      this.wheels.frontRight.rotation.x = this.wheelRotations.frontRight;
    }

    if (this.wheels.backLeft) {
      this.wheels.backLeft.rotation.x = this.wheelRotations.backLeft;
    }

    if (this.wheels.backRight) {
      this.wheels.backRight.rotation.x = this.wheelRotations.backRight;
    }
  }

  /**
   * Gère la rotation horizontale des roues lors du braquage (gauche/droite)
   */
  private updateSteering(
    inputs: any,
    deltaTime: number,
    movingForward: boolean
  ): void {
    // Détermination de l'angle cible de braquage
    let targetAngle = 0;

    // Déterminer la direction du braquage
    if (inputs.left) targetAngle += this.maxSteeringAngle;
    if (inputs.right) targetAngle -= this.maxSteeringAngle;

    // En marche arrière, on ne change PAS le sens de braquage car la voiture
    // se comporte comme si on poussait le volant dans la direction souhaitée
    // C'est le comportement réel d'une voiture (on tourne à gauche pour faire reculer vers la gauche)

    // Appliquer l'inertie au braquage pour un mouvement fluide
    const steeringLerpFactor = Math.min(1, this.steeringSpeed * deltaTime * 60);
    this.currentSteeringAngle +=
      (targetAngle - this.currentSteeringAngle) * steeringLerpFactor;

    // Appliquer la rotation horizontale aux conteneurs de roues avant
    if (this.wheelContainers.frontLeft) {
      this.wheelContainers.frontLeft.rotation.y = this.currentSteeringAngle;
    }

    if (this.wheelContainers.frontRight) {
      this.wheelContainers.frontRight.rotation.y = this.currentSteeringAngle;
    }
  }

  /**
   * Vérifie que toutes les roues sont prêtes
   */
  private areWheelsReady(): boolean {
    return Object.values(this.wheels).every((wheel) => wheel !== null);
  }

  /**
   * Renvoie les paramètres pour l'interface GUI
   */
  public getWheelParams(): any {
    const self = this;
    return {
      get wheelRadius() {
        return self.wheelParams.wheelRadius;
      },
      set wheelRadius(value: number) {
        self.wheelParams.wheelRadius = value;
        self.wheelRadius = value;
      },

      get wheelInertia() {
        return self.wheelParams.wheelInertia;
      },
      set wheelInertia(value: number) {
        self.wheelParams.wheelInertia = value;
        self.wheelInertia = value;
      },

      get wheelSpeedMultiplier() {
        return self.wheelParams.wheelSpeedMultiplier;
      },
      set wheelSpeedMultiplier(value: number) {
        self.wheelParams.wheelSpeedMultiplier = value;
        self.wheelSpeedMultiplier = value;
      },

      get maxSteeringAngle() {
        return self.wheelParams.maxSteeringAngle;
      },
      set maxSteeringAngle(value: number) {
        self.wheelParams.maxSteeringAngle = value;
        self.maxSteeringAngle = value;
      },

      get steeringSpeed() {
        return self.wheelParams.steeringSpeed;
      },
      set steeringSpeed(value: number) {
        self.wheelParams.steeringSpeed = value;
        self.steeringSpeed = value;
      },
    };
  }
}
