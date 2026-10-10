package services

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"pentagi/pkg/modelcredentials"

	"github.com/gin-gonic/gin"
)

type ModelServiceService struct {
	store *modelcredentials.Store
}

func NewModelServiceService(store *modelcredentials.Store) *ModelServiceService {
	return &ModelServiceService{store: store}
}

type modelServiceRequest struct {
	Name    string `json:"name"`
	BaseURL string `json:"baseUrl"`
}

type modelCredentialCreateRequest struct {
	Name   string `json:"name"`
	Remark string `json:"remark"`
	Secret string `json:"secret"`
}

type modelCredentialUpdateRequest struct {
	Name    string  `json:"name"`
	Remark  string  `json:"remark"`
	Enabled bool    `json:"enabled"`
	Secret  *string `json:"secret"`
}

func modelServiceError(c *gin.Context, status int, err error) {
	message := "操作失败"
	switch {
	case errors.Is(err, modelcredentials.ErrCredentialInUse):
		message = "该密钥正在被模型提供商使用，请先更换或删除相关模型提供商"
	case errors.Is(err, modelcredentials.ErrServiceInUse):
		message = "该模型服务仍有密钥或模型提供商，请先清理关联内容"
	case errors.Is(err, modelcredentials.ErrBuiltinService):
		message = "内置模型服务不能修改或删除"
	case err != nil && strings.TrimSpace(err.Error()) != "":
		message = err.Error()
	}
	c.AbortWithStatusJSON(status, gin.H{"status": "error", "msg": message})
}

func requireModelServicePermission(c *gin.Context, edit bool) bool {
	required := "settings.providers.view"
	if edit {
		required = "settings.providers.edit"
	}
	for _, permission := range c.GetStringSlice("prm") {
		if permission == required || permission == "settings.providers.admin" {
			return true
		}
	}
	modelServiceError(c, http.StatusForbidden, errors.New("没有模型服务管理权限"))
	return false
}

func parseModelServiceID(c *gin.Context, name string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil || id <= 0 {
		modelServiceError(c, http.StatusBadRequest, errors.New("无效的 ID"))
		return 0, false
	}
	return id, true
}

func (s *ModelServiceService) List(c *gin.Context) {
	if !requireModelServicePermission(c, false) {
		return
	}
	items, err := s.store.List(c, int64(c.GetUint64("uid")))
	if err != nil {
		modelServiceError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": items})
}

func (s *ModelServiceService) CreateService(c *gin.Context) {
	if !requireModelServicePermission(c, true) {
		return
	}
	var req modelServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		modelServiceError(c, http.StatusBadRequest, errors.New("请求内容格式错误"))
		return
	}
	item, err := s.store.CreateService(c, int64(c.GetUint64("uid")), req.Name, req.BaseURL)
	if err != nil {
		modelServiceError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "success", "data": item})
}

func (s *ModelServiceService) UpdateService(c *gin.Context) {
	if !requireModelServicePermission(c, true) {
		return
	}
	id, ok := parseModelServiceID(c, "serviceID")
	if !ok {
		return
	}
	var req modelServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		modelServiceError(c, http.StatusBadRequest, errors.New("请求内容格式错误"))
		return
	}
	item, err := s.store.UpdateService(c, int64(c.GetUint64("uid")), id, req.Name, req.BaseURL)
	if err != nil {
		modelServiceError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": item})
}

func (s *ModelServiceService) DeleteService(c *gin.Context) {
	if !requireModelServicePermission(c, true) {
		return
	}
	id, ok := parseModelServiceID(c, "serviceID")
	if !ok {
		return
	}
	if err := s.store.DeleteService(c, int64(c.GetUint64("uid")), id); err != nil {
		modelServiceError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (s *ModelServiceService) CreateCredential(c *gin.Context) {
	if !requireModelServicePermission(c, true) {
		return
	}
	serviceID, ok := parseModelServiceID(c, "serviceID")
	if !ok {
		return
	}
	var req modelCredentialCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		modelServiceError(c, http.StatusBadRequest, errors.New("请求内容格式错误"))
		return
	}
	item, err := s.store.CreateCredential(
		c, int64(c.GetUint64("uid")), serviceID, req.Name, req.Remark, req.Secret,
	)
	if err != nil {
		modelServiceError(c, http.StatusBadRequest, err)
		return
	}
	item.Secret = nil
	c.JSON(http.StatusCreated, gin.H{"status": "success", "data": item})
}

func (s *ModelServiceService) UpdateCredential(c *gin.Context) {
	if !requireModelServicePermission(c, true) {
		return
	}
	id, ok := parseModelServiceID(c, "credentialID")
	if !ok {
		return
	}
	var req modelCredentialUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		modelServiceError(c, http.StatusBadRequest, errors.New("请求内容格式错误"))
		return
	}
	item, err := s.store.UpdateCredential(
		c, int64(c.GetUint64("uid")), id, req.Name, req.Remark, req.Enabled, req.Secret,
	)
	if err != nil {
		modelServiceError(c, http.StatusBadRequest, err)
		return
	}
	item.Secret = nil
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": item})
}

func (s *ModelServiceService) DeleteCredential(c *gin.Context) {
	if !requireModelServicePermission(c, true) {
		return
	}
	id, ok := parseModelServiceID(c, "credentialID")
	if !ok {
		return
	}
	if err := s.store.DeleteCredential(c, int64(c.GetUint64("uid")), id); err != nil {
		modelServiceError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}
