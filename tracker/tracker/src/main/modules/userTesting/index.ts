import * as styles from './styles.js'
import Recorder, { Quality } from './recorder.js'

function createElement(
  tag: string,
  className: string,
  styles: any,
  textContent?: string,
  id?: string,
) {
  const element = document.createElement(tag)
  element.className = className
  Object.assign(element.style, styles)
  if (textContent) {
    element.textContent = textContent
  }
  if (id) {
    element.id = id
  }
  return element
}

export default class UserTestManager {
  private readonly userRecorder = new Recorder()
  private readonly bg = createElement('div', 'bg', styles.bgStyle, undefined, '__or_ut_bg')
  private readonly container = createElement(
    'div',
    'container',
    styles.containerStyle,
    undefined,
    '__or_ut_ct',
  )
  private widgetGuidelinesVisible = true
  private widgetTasksVisible = false
  private widgetVisible = true
  private descriptionSection: HTMLElement | null = null
  private taskSection: HTMLElement | null = null
  private endSection: HTMLElement | null = null
  private stopButton: HTMLElement | null = null

  hideTaskSection = () => false
  showTaskSection = () => true
  collapseWidget = () => false

  createGreeting(title: string, micRequired: boolean, cameraRequired: boolean) {
    const titleElement = createElement('div', 'title', styles.titleStyle, title)
    const descriptionElement = createElement(
      'div',
      'description',
      styles.descriptionStyle,
      'Welcome, this session will be recorded. You have complete control, and can stop the session at any time.',
    )
    const noticeElement = createElement(
      'div',
      'notice',
      styles.noticeStyle,
      'Please note that your audio, video, and screen will be recorded for research purposes during this test.',
    )
    const buttonElement = createElement(
      'div',
      'button',
      styles.buttonStyle,
      'Read guidelines to begin',
    )

    buttonElement.onclick = () => {
      this.container.innerHTML = ''
      void this.userRecorder.startRecording(30, Quality.Standard)
      this.showWidget(
        [
          'Please be honest and open with your feedback. We want to hear your thoughts, both positive and negative, about your experience using Product Name.',
          'Feel free to think out loud during the test. Sharing your thought process as you complete tasks will help us understand your perspective better.',
        ],
        [
          {
            title: 'Task 1',
            description: 'This is a test description here',
          },
          {
            title: 'Task 2',
            description:
              'This is a test description here there and not only there, more stuff to come',
          },
        ],
      )
    }

    this.container.append(titleElement, descriptionElement, noticeElement, buttonElement)
    this.bg.appendChild(this.container)
    document.body.appendChild(this.bg)
  }

  showWidget(
    description: string[],
    tasks: {
      title: string
      description: string
    }[],
  ) {
    this.container.innerHTML = ''
    Object.assign(this.bg.style, {
      position: 'absolute',
      right: '8px',
      left: 'unset',
      width: 'fit-content',
      top: '8px',
      height: 'fit-content',
      background: 'unset',
      display: 'unset',
      alignItems: 'unset',
      justifyContent: 'unset',
    })
    // Create title section
    const titleSection = this.createTitleSection()
    Object.assign(this.container.style, styles.containerWidgetStyle)
    const descriptionSection = this.createDescriptionSection(description)
    const tasksSection = this.createTasksSection(tasks)
    const stopButton = createElement('div', 'stop_bn_or', styles.stopWidgetStyle, 'Abort Session')

    this.container.append(titleSection, descriptionSection, tasksSection, stopButton)
    this.taskSection = tasksSection
    this.descriptionSection = descriptionSection
    this.stopButton = stopButton
    stopButton.onclick = () => {
      this.userRecorder.discard()
      document.body.removeChild(this.bg)
    }
    this.hideTaskSection()
  }

  createTitleSection() {
    const title = createElement('div', 'title', styles.titleWidgetStyle)
    const leftIcon = createElement('div', 'left_icon', {}, '(icn)')
    const titleText = createElement('div', 'title_text', {}, 'Test name goes here')
    const rightIcon = createElement('div', 'right_icon', { marginLeft: 'auto' }, '(icn)')

    title.append(leftIcon, titleText, rightIcon)

    const toggleWidget = (isVisible: boolean) => {
      this.widgetVisible = isVisible
      Object.assign(
        this.container.style,
        this.widgetVisible
          ? styles.containerWidgetStyle
          : { border: 'none', background: 'none', padding: 0 },
      )
      if (this.taskSection) {
        Object.assign(
          this.taskSection.style,
          this.widgetVisible ? styles.descriptionWidgetStyle : { display: 'none' },
        )
      }
      if (this.descriptionSection) {
        Object.assign(
          this.descriptionSection.style,
          this.widgetVisible ? styles.descriptionWidgetStyle : { display: 'none' },
        )
      }
      if (this.endSection) {
        Object.assign(
          this.endSection.style,
          this.widgetVisible ? styles.descriptionWidgetStyle : { display: 'none' },
        )
      }
      if (this.stopButton) {
        Object.assign(
          this.stopButton.style,
          this.widgetVisible ? styles.stopWidgetStyle : { display: 'none' },
        )
      }
      return isVisible
    }
    title.onclick = () => toggleWidget(!this.widgetVisible)
    this.collapseWidget = () => toggleWidget(false)
    return title
  }

  createDescriptionSection(description: string[]) {
    const section = createElement('div', 'description_section_or', styles.descriptionWidgetStyle)
    const titleContainer = createElement('div', 'description_s_title_or', styles.sectionTitleStyle)
    const title = createElement('div', 'title', {}, 'Introduction & Guidelines')
    const icon = createElement('div', 'icon', styles.symbolIcon, '-')
    const content = createElement('div', 'content', styles.contentStyle)
    const ul = document.createElement('ul')
    ul.innerHTML = description.map((item) => `<li>${item}</li>`).join('')
    const button = createElement('div', 'button_begin_or', styles.buttonWidgetStyle, 'Begin Test')

    titleContainer.append(title, icon)
    content.append(ul, button)
    section.append(titleContainer, content)

    const toggleDescriptionVisibility = () => {
      this.widgetGuidelinesVisible = !this.widgetGuidelinesVisible
      icon.textContent = this.widgetGuidelinesVisible ? '-' : '+'
      Object.assign(
        content.style,
        this.widgetGuidelinesVisible ? styles.contentStyle : { display: 'none' },
      )
    }

    titleContainer.onclick = toggleDescriptionVisibility
    button.onclick = () => {
      toggleDescriptionVisibility()
      this.showTaskSection()
    }

    return section
  }

  createTasksSection(
    tasks: {
      title: string
      description: string
    }[],
  ) {
    let currentTaskIndex = 0
    const section = createElement('div', 'task_section_or', styles.descriptionWidgetStyle)
    const titleContainer = createElement('div', 'description_t_title_or', styles.sectionTitleStyle)
    const title = createElement('div', 'title', {}, 'Tasks')
    const icon = createElement('div', 'icon', styles.symbolIcon, '-')
    const content = createElement('div', 'content', styles.contentStyle)
    const pagination = createElement('div', 'pagination', styles.paginationStyle)
    const leftArrow = createElement('span', 'leftArrow', {}, '<')
    const rightArrow = createElement('span', 'rightArrow', {}, '>')
    const taskCard = createElement('div', 'taskCard', styles.taskDescriptionCard)
    const taskText = createElement('div', 'taskText', styles.taskTextStyle)
    const taskDescription = createElement('div', 'taskDescription', styles.taskDescriptionStyle)
    const taskButtons = createElement('div', 'taskButtons', styles.taskButtonsRow)
    const closePanelButton = createElement(
      'div',
      'closePanelButton',
      styles.taskButtonStyle,
      'Collapse panel',
    )
    const nextButton = createElement(
      'div',
      'nextButton',
      styles.taskButtonBorderedStyle,
      'Done, next',
    )

    titleContainer.append(title, icon)
    taskCard.append(taskText, taskDescription)
    taskButtons.append(closePanelButton, nextButton)
    content.append(pagination, taskCard, taskButtons)
    section.append(titleContainer, content)

    const updateTaskContent = () => {
      const task = tasks[currentTaskIndex]
      taskText.textContent = task.title
      taskDescription.textContent = task.description
    }

    pagination.appendChild(leftArrow)
    tasks.forEach((_, index) => {
      const pageNumber = createElement('span', `or_task_${index}`, {}, (index + 1).toString())
      pageNumber.id = `or_task_${index}`
      pagination.append(pageNumber)
    })
    pagination.appendChild(rightArrow)

    const toggleTasksVisibility = () => {
      this.widgetTasksVisible = !this.widgetTasksVisible
      icon.textContent = this.widgetTasksVisible ? '-' : '+'
      Object.assign(
        content.style,
        this.widgetTasksVisible ? styles.contentStyle : { display: 'none' },
      )
    }
    this.hideTaskSection = () => {
      icon.textContent = '+'
      Object.assign(content.style, {
        display: 'none',
      })
      this.widgetTasksVisible = false
      return false
    }
    this.showTaskSection = () => {
      icon.textContent = '-'
      Object.assign(content.style, styles.contentStyle)
      this.widgetTasksVisible = true
      return true
    }

    titleContainer.onclick = toggleTasksVisibility
    closePanelButton.onclick = this.collapseWidget

    nextButton.onclick = () => {
      if (currentTaskIndex < tasks.length - 1) {
        currentTaskIndex++
        updateTaskContent()
        const activeTaskEl = document.getElementById(`or_task_${currentTaskIndex}`)
        if (activeTaskEl) {
          Object.assign(activeTaskEl.style, styles.taskNumberActive)
        }
        for (let i = 0; i < currentTaskIndex; i++) {
          const taskEl = document.getElementById(`or_task_${i}`)
          if (taskEl) {
            Object.assign(taskEl.style, styles.taskNumberDone)
          }
        }
      } else {
        this.showEndSection()
      }
    }

    updateTaskContent()
    setTimeout(() => {
      const firstTaskEl = document.getElementById('or_task_0')
      console.log(firstTaskEl, styles.taskNumberActive)
      if (firstTaskEl) {
        Object.assign(firstTaskEl.style, styles.taskNumberActive)
      }
    }, 1)
    return section
  }

  showEndSection() {
    void this.userRecorder.saveToFile()
    const section = createElement('div', 'end_section_or', styles.endSectionStyle)
    const title = createElement(
      'div',
      'end_title_or',
      {
        fontSize: '1.25rem',
        fontWeight: '500',
      },
      'Thank you! 👍',
    )
    const description = createElement(
      'div',
      'end_description_or',
      {},
      'Thank you for participating in our user test. Your feedback has been captured and will be used to enhance our website. \n' +
        '\n' +
        'We appreciate your time and valuable input.',
    )
    const button = createElement('div', 'end_button_or', styles.buttonWidgetStyle, 'End Session')

    if (this.taskSection) {
      this.container.removeChild(this.taskSection)
    }
    if (this.descriptionSection) {
      this.container.removeChild(this.descriptionSection)
    }
    if (this.stopButton) {
      this.container.removeChild(this.stopButton)
    }

    button.onclick = () => {
      document.body.removeChild(this.bg)
    }
    section.append(title, description, button)
    this.endSection = section
    this.container.append(section)
  }
}
