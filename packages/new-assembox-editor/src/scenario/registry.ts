import type { ScenarioProfile } from './types';

class ScenarioRegistryImpl {
  private profiles = new Map<string, ScenarioProfile>();
  private currentProfile: ScenarioProfile | null = null;

  register(profile: ScenarioProfile): void {
    if (this.profiles.has(profile.id)) {
      console.warn(`[ScenarioRegistry] 场景 "${profile.id}" 已注册，覆盖`);
    }
    this.profiles.set(profile.id, profile);
  }

  activate(id: string): ScenarioProfile {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`[ScenarioRegistry] 场景 "${id}" 未注册`);
    }
    if (this.currentProfile?.id === id) return this.currentProfile;
    this.currentProfile?.destroy?.();
    this.currentProfile = profile;
    return profile;
  }

  getCurrent(): ScenarioProfile {
    if (!this.currentProfile) {
      throw new Error('[ScenarioRegistry] 未激活任何场景，请先 activate');
    }
    return this.currentProfile;
  }

  has(id: string): boolean {
    return this.profiles.has(id);
  }

  list(): string[] {
    return Array.from(this.profiles.keys());
  }
}

export const scenarioRegistry = new ScenarioRegistryImpl();

export function registerScenario(profile: ScenarioProfile): void {
  scenarioRegistry.register(profile);
}
