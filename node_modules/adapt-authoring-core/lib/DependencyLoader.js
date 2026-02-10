/* eslint no-console: 0 */
import _ from 'lodash'
import fs from 'fs-extra'
import { glob } from 'glob'
import path from 'path'
import Hook from './Hook.js'
import Utils from './Utils.js'
/**
 * Handles the loading of Adapt authoring tool module dependencies.
 * @memberof core
 */
class DependencyLoader {
  /**
   * @param {Object} app The main app instance
   */
  constructor (app) {
    /**
     * Name of the class (onvenience function to stay consistent with other classes)
     * @type {String}
     */
    this.name = this.constructor.name
    /**
     * Reference to the main app
     * @type {App}
     */
    this.app = app
    /**
     * Key/value store of all the Adapt dependencies' configs. Note this includes dependencies which are not loaded as Adapt modules (i.e. `module: false`).
     * @type {Object}
     */
    this.configs = {}
    /**
     * List of dependency instances
     * @type {object}
     */
    this.instances = {}
    /**
     * Peer dependencies listed for each dependency
     * @type {object}
     */
    this.peerDependencies = {}
    /**
     * List of modules which have failed to load
     * @type {Array}
     */
    this.failedModules = []
    /**
     * Hook called once all module configs are loaded
     * @type {Hook}
     */
    this.configsLoadedHook = new Hook()
    /**
     * Hook for individual module load
     * @type {Hook}
     */
    this.moduleLoadedHook = new Hook()
  }

  /**
   * Loads all Adapt module dependencies
   * @return {Promise}
   */
  async load () {
    await this.loadConfigs()

    const configValues = Object.values(this.configs)
    // sort dependencies into priority
    const { essential, theRest } = configValues.reduce((m, c) => {
      this.app.pkg.essentialApis.includes(c.essentialType) ? m.essential.push(c.name) : m.theRest.push(c.name)
      return m
    }, { essential: [], theRest: [] })
    // load each set of deps
    await this.loadModules(essential)
    try {
      await this.loadModules(theRest)
    } catch (e) {} // not a problem if non-essential module fails to load

    if (this.failedModules.length) {
      throw new Error(`Failed to load modules ${this.failedModules.join(', ')}`)
    }
  }

  /**
   * Loads configs for all dependencies
   * @return {Promise}
   */
  async loadConfigs () {
    /** @ignore */ this._configsLoaded = false
    const files = await glob(`${this.app.rootDir}/node_modules/**/${Utils.metadataFileName}`)
    const deps = files
      .map(d => d.replace(`${Utils.metadataFileName}`, ''))
      .sort((a, b) => a.length < b.length ? -1 : 1)

    const configCache = {}
    await Promise.all(deps.map(async d => {
      try {
        configCache[d] = await this.loadModuleConfig(d)
      } catch (e) {
        this.logError(`Failed to load config for '${d}', module will not be loaded`)
        this.logError(e)
      }
    }))
    deps.forEach(d => {
      const c = configCache[d]
      if (this.configs[c.name]) {
        return
      }
      this.configs[c.name] = c
      if (c.peerDependencies) {
        Object.keys(c.peerDependencies).forEach(p => {
          this.peerDependencies[p] = [...(this.peerDependencies[p] || []), c.name]
        })
      }
    })
    this._configsLoaded = true
    await this.configsLoadedHook.invoke()
  }

  /**
   * Loads the relevant configuration files for an Adapt module
   * @param {String} modDir Module directory
   * @return {Promise}
   */
  async loadModuleConfig (modDir) {
    return {
      ...await fs.readJson(path.join(modDir, Utils.packageFileName)),
      ...await fs.readJson(path.join(modDir, Utils.metadataFileName)),
      rootDir: modDir
    }
  }

  /**
   * Loads a single Adapt module. Should not need to be called directly.
   * @param {String} modName Name of the module to load
   * @return {Promise} Resolves with module instance on module.onReady
   */
  async loadModule (modName) {
    if (this.instances[modName]) {
      throw new Error('Module already exists')
    }
    const config = this.configs[modName]

    if (config.module === false) {
      return
    }
    const { default: ModClass } = await import(modName)

    if (!_.isFunction(ModClass)) {
      throw new Error('Expected class to be exported')
    }
    const instance = new ModClass(this.app, config)

    if (!_.isFunction(instance.onReady)) {
      throw new Error('Module must define onReady function')
    }
    try {
      await Promise.race([
        instance.onReady(),
        new Promise((resolve, reject) => setTimeout(() => reject(new Error(`${modName} load exceeded timeout (60000)`)), 60000))
      ])
      this.instances[modName] = instance
      await this.moduleLoadedHook.invoke(null, instance)
      return instance
    } catch (e) {
      await this.moduleLoadedHook.invoke(e)
      throw e
    }
  }

  /**
   * Loads a list of Adapt modules. Should not need to be called directly.
   * @param {Array} modules Module names
   * @return {Promise} Resolves When all modules have loaded (or failed to load)
   */
  async loadModules (modules) {
    await Promise.allSettled(modules.map(async m => {
      try {
        await this.loadModule(m)
      } catch (e) {
        this.logError(`Failed to load '${m}',`, e)
        const deps = this.peerDependencies[m]
        if (deps && deps.length) {
          this.logError('The following modules are peer dependencies, and may not work:')
          deps.forEach(d => this.logError(`- ${d}`))
        }
        this.failedModules.push(m)
      }
    }))
  }

  /**
   * Waits for a single module to load
   * @param {String} modName Name of module to wait for
   * @return {Promise} Resolves with module instance on module.onReady
   */
  async waitForModule (modName) {
    if (!this._configsLoaded) {
      await this.configsLoadedHook.onInvoke()
    }
    const longPrefix = 'adapt-authoring-'
    if (!modName.startsWith(longPrefix)) modName = `adapt-authoring-${modName}`
    if (!this.configs[modName]) {
      throw new Error(`Missing required module '${modName}'`)
    }
    if (this.failedModules.includes(modName)) {
      throw new Error(`dependency '${modName}' failed to load`)
    }
    const instance = this.instances[modName]
    if (instance) {
      return instance.onReady()
    }
    return new Promise((resolve, reject) => {
      this.moduleLoadedHook.tap((error, instance) => {
        if (error) return reject(error)
        if (instance?.name === modName) resolve(instance)
      })
    })
  }

  /**
   * Logs an error message
   * @param {...*} args Arguments to be printed
   */
  logError (...args) {
    if (this.app.logger && this.app.logger._isReady) {
      this.app.logger.log('error', this.name, ...args)
    } else {
      console.log(...args)
    }
  }
}

export default DependencyLoader
