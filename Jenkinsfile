// Pipeline de `learning`, compose a partir des blocs de la bibliotheque
// partagee (theo-mrn/jenkins-shared-lib).
//
// Reproduit ce que fait .github/workflows/deploy.yml :
//   qualite -> deux images -> scan -> promotion GitOps -> ArgoCD reconcilie.
//
// ⚠️ Le workflow GitHub Actions tourne ENCORE en parallele. Tant que les deux
// sont actifs, un push sur main declenche les deux chaines, qui poussent
// chacune un commit de promotion dans argocd_registry. Couper deploy.yml une
// fois ce pipeline valide.
//
// ⭐ Le tag est fige une seule fois, au checkout, et reutilise partout : les
// deux images et le commit de promotion portent donc forcement le meme SHA.
// Appliquer les migrations d'une version au code d'une autre est exactement
// ce qu'on veut eviter.

@Library('shared-lib@v1.0.0') _

def sha

pipeline {
    agent {
        kubernetes {
            // `sonar` est indispensable des lors que le pipeline appelle
            // sonarScan : chaque bloc s'execute dans le conteneur du meme nom,
            // et un outil absent de cette liste echoue sur
            // « container <nom> not found in pod ».
            yaml buildAgent(tools: ['node', 'kaniko', 'trivy', 'git', 'sonar'])
        }
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        // Deux builds concurrents promouvraient deux tags dans le meme
        // depot GitOps, avec un rebase perdant.
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    def vars = checkout scm
                    sha = vars.GIT_COMMIT.take(7)
                    echo "Version construite : ${sha}"
                }
            }
        }

        stage('Qualite') {
            // Analyses independantes : les paralleliser raccourcit d'autant.
            parallel {
                stage('Lint') {
                    steps {
                        container('node') {
                            sh 'npm ci'
                            sh 'npm run lint'
                        }
                    }
                }
                stage('Sonar') {
                    steps {
                        // Le Global Analysis Token cree le projet a la volee :
                        // rien a declarer dans l'UI au prealable.
                        sonarScan(
                            projectKey: 'theo-mrn_learning',
                            sources: 'app,components,hooks,lib',
                        )
                    }
                }
                stage('Trivy depot') {
                    steps {
                        // Dependances et secrets en clair, avant tout build.
                        trivyScan(mode: 'fs', target: '.')
                    }
                }
            }
        }

        stage('Images') {
            steps {
                script {
                    // Deux etages du meme Dockerfile, deux images, meme SHA.
                    dockerBuild(
                        image: 'ghcr.io/theo-mrn/learning',
                        target: 'runner',
                        tag: sha,
                        extraTags: ['latest'],
                    )
                    dockerBuild(
                        image: 'ghcr.io/theo-mrn/learning-migrator',
                        target: 'migrator',
                        tag: sha,
                        extraTags: ['latest'],
                    )
                }
            }
        }

        stage('Scan image') {
            steps {
                // Informatif : on observe ce que le scan remonte avant d'en
                // faire un blocage (failOnFound: true).
                trivyScan(image: "ghcr.io/theo-mrn/learning:${sha}")
            }
        }

        stage('Promotion') {
            // Seule main promeut : une branche construit et scanne, sans
            // rien deployer.
            when { branch 'main' }
            steps {
                argocdBump(
                    path: 'kubernetes/system/learning',
                    images: [
                        'ghcr.io/theo-mrn/learning'         : 'app.yml',
                        'ghcr.io/theo-mrn/learning-migrator': 'migration-job.yml',
                    ],
                    tag: sha,
                    message: "learning: ${sha}",
                )
            }
        }
    }

    post {
        success { echo "OK — ${sha} promu, ArgoCD reconcilie." }
        failure { echo "ECHEC — rien n'a ete promu." }
    }
}
