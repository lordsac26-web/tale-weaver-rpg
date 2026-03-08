import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// ─── Singleton GLTFLoader with cache ──────────────────────────────────────────

const loader = new GLTFLoader();
const modelCache = new Map();

/**
 * Load a GLTF/GLB model from a URL.
 * Returns a promise that resolves to a cloned scene group.
 * Caches the original so subsequent loads are instant.
 */
export function loadGLTFModel(url) {
  if (!url) return Promise.resolve(null);

  // Return cached clone
  if (modelCache.has(url)) {
    const cached = modelCache.get(url);
    return Promise.resolve(cached.scene.clone());
  }

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        modelCache.set(url, gltf);
        resolve(gltf.scene.clone());
      },
      undefined,
      (error) => {
        console.error('GLTF load error:', error);
        reject(error);
      }
    );
  });
}

/**
 * Prepare a loaded tower model for the scene:
 * - Tags all children as isTowerElement for cleanup
 * - Enables shadows
 * - Applies optional scale/position
 */
export function prepareTowerModel(model, options = {}) {
  const { scale = 1, position = [0, 0, 0] } = options;

  model.userData.isTowerElement = true;
  model.userData.isCustomModel = true;
  model.scale.setScalar(scale);
  model.position.set(...position);

  model.traverse((child) => {
    child.userData.isTowerElement = true;
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return model;
}

/**
 * Prepare a loaded die model:
 * - Sets scale to match expected die radius
 * - Enables shadows
 */
export function prepareDieModel(model, options = {}) {
  const { scale = 0.45 } = options;

  model.scale.setScalar(scale);
  model.userData.isCustomDie = true;

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return model;
}

/**
 * Clear a specific URL from the cache
 */
export function clearModelCache(url) {
  if (url) modelCache.delete(url);
  else modelCache.clear();
}