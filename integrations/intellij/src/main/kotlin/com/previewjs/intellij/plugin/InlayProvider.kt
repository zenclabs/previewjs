package com.previewjs.intellij.plugin

import com.intellij.codeInsight.hints.ChangeListener
import com.intellij.codeInsight.hints.FactoryInlayHintsCollector
import com.intellij.codeInsight.hints.ImmediateConfigurable
import com.intellij.codeInsight.hints.InlayHintsCollector
import com.intellij.codeInsight.hints.InlayHintsProvider
import com.intellij.codeInsight.hints.InlayHintsSink
import com.intellij.codeInsight.hints.NoSettings
import com.intellij.codeInsight.hints.SettingsKey
import com.intellij.codeInsight.hints.presentation.MouseButton
import com.intellij.codeInsight.hints.presentation.PresentationFactory
import com.intellij.lang.Language
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Editor
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.previewjs.intellij.plugin.services.ProjectService
import kotlinx.coroutines.runBlocking
import java.awt.Cursor
import javax.swing.JPanel

@Suppress("UnstableApiUsage")
class InlayProvider : InlayHintsProvider<NoSettings> {
    override val key = SettingsKey<NoSettings>(InlayProvider::class.qualifiedName!!)
    override val name = "Preview.js hints"
    override val previewText = null
    override fun createSettings() = NoSettings()

    override val isVisibleInSettings = false

    override fun isLanguageSupported(language: Language): Boolean {
        val logger = Logger.getInstance(InlayProvider::class.java)
        logger.warn("Is language supported: ${language.id}")
        return true
    }

    override fun getCollectorFor(
        file: PsiFile,
        editor: Editor,
        settings: NoSettings,
        sink: InlayHintsSink
    ): InlayHintsCollector {
        return collector
    }

    private val collector = object : InlayHintsCollector {
        override fun collect(element: PsiElement, editor: Editor, sink: InlayHintsSink): Boolean {
            if (element !is PsiFile) {
                return false
            }
            val projectService = element.project.service<ProjectService>()
            val components = runBlocking {
                projectService.computeComponents(element.virtualFile, editor.document)
            }
            val factory = PresentationFactory(editor)
            for (component in components) {
                sink.addBlockElement(
                    component.start,
                    relatesToPrecedingText = false,
                    showAbove = true,
                    priority = 0,
                    presentation = factory.onClick(
                        factory.withCursorOnHover(
                            factory.roundWithBackground(factory.smallText("Open ${component.componentName} in Preview.js")),
                            Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
                        ), MouseButton.Left
                    ) { _, _ ->
                        projectService.openPreview(element.virtualFile.path, component.componentId)
                    }
                )
            }
            return false
        }
    }

    override fun createConfigurable(settings: NoSettings): ImmediateConfigurable {
        return object : ImmediateConfigurable {
            override fun createComponent(listener: ChangeListener) = JPanel()
        }
    }
}